-- Close entitlement review findings before V1 production rollout.

-- Safely transition any rows created during a partial/staged deployment.
-- Expired removes access without inventing billing dates.
update public.user_subscriptions
set status = 'expired',
    updated_at = now()
where status in ('trialing', 'active')
  and (
    current_period_start is null
    or current_period_end is null
    or current_period_end <= current_period_start
  );

alter table public.user_subscriptions
  add constraint user_subscriptions_entitled_period_check
  check (
    status not in ('trialing', 'active')
    or (
      current_period_start is not null
      and current_period_end is not null
      and current_period_end > current_period_start
      and (
        plan_key = 'starter'
        or current_period_end < 'infinity'::timestamptz
      )
    )
  );

-- Starter is the free baseline. Provision every existing account before
-- enforcing estimate boundaries, and extend onboarding so new accounts receive
-- the same non-expiring free access. Paid provider subscriptions replace this row.
insert into public.user_subscriptions (
  user_id, plan_key, status, current_period_start, current_period_end
)
select users.id, 'starter', 'active', now(), 'infinity'::timestamptz
from auth.users as users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $onboarding$
declare
  _role_count integer;
  _invite public.invitations%rowtype;
  _invite_token text := nullif(new.raw_user_meta_data ->> 'invite_token', '');
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );

  insert into public.user_subscriptions (
    user_id, plan_key, status, current_period_start, current_period_end
  )
  values (new.id, 'starter', 'active', now(), 'infinity'::timestamptz);

  lock table public.user_roles in share row exclusive mode;

  select count(*) into _role_count
  from public.user_roles;

  if _role_count = 0 then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role);
  elsif _invite_token is not null then
    select * into _invite
    from public.invitations
    where token = _invite_token
      and accepted_at is null
      and expires_at >= now()
      and lower(email) = lower(new.email)
    for update;

    if found then
      insert into public.user_roles (user_id, role)
      values (new.id, _invite.role);

      update public.invitations
      set accepted_at = now(),
          accepted_by = new.id,
          updated_at = now()
      where id = _invite.id;
    end if;
  end if;

  return new;
end;
$onboarding$;

revoke all on function public.handle_new_user()
from public, anon, authenticated;

create or replace function public.has_entitlement(_feature_key text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  _user_id uuid := auth.uid();
  _override boolean;
  _plan_key text;
begin
  if _user_id is null or _feature_key is null or _feature_key !~ '^[a-z][a-z0-9_]*$' then return false; end if;
  if public.has_role(_user_id,'admin'::public.app_role) then return true; end if;

  select enabled into _override
  from public.user_entitlement_overrides
  where user_id=_user_id and feature_key=_feature_key
    and (expires_at is null or expires_at > now());
  if found then return _override; end if;

  select plan_key into _plan_key from public.user_subscriptions
  where user_id=_user_id
    and status in ('trialing','active')
    and current_period_start is not null
    and current_period_start <= now()
    and current_period_end is not null
    and current_period_end > now()
    and (
      plan_key = 'starter'
      or current_period_end < 'infinity'::timestamptz
    );

  -- Expired, canceled, paused, or malformed paid periods downgrade to
  -- the free Starter catalog rather than removing core estimate access.
  if _plan_key is null then
    _plan_key := 'starter';
  end if;

  return exists(select 1 from public.plan_entitlements
    where plan_key=_plan_key and feature_key=_feature_key and enabled=true);
end; $$;

revoke all on function public.has_entitlement(text) from public, anon, authenticated;
grant execute on function public.has_entitlement(text) to authenticated, service_role;

create or replace function public.enforce_estimates_core_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $entitlement_trigger$
begin
  -- Trusted backend/database roles may perform reconciliation and maintenance.
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not public.has_entitlement('estimates_core') then
    raise exception 'Estimate subscription required'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$entitlement_trigger$;

revoke all on function public.enforce_estimates_core_entitlement() from public, anon;
grant execute on function public.enforce_estimates_core_entitlement() to authenticated, service_role;

drop trigger if exists trg_estimates_require_entitlement on public.estimates;
create trigger trg_estimates_require_entitlement
before insert or update or delete on public.estimates
for each row execute function public.enforce_estimates_core_entitlement();

drop trigger if exists trg_estimate_lines_require_entitlement on public.estimate_line_items;
create trigger trg_estimate_lines_require_entitlement
before insert or update or delete on public.estimate_line_items
for each row execute function public.enforce_estimates_core_entitlement();

-- Match the existing estimate screens: markup is calculated from subtotal only.

create or replace function public.create_estimate_builder_draft(
  p_project_id uuid,
  p_items jsonb,
  p_scope_notes text default null,
  p_markup_pct numeric default 0,
  p_contingency_pct numeric default 0,
  p_tax_pct numeric default 0,
  p_deliverables text[] default '{}'::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_estimate_id uuid;
  v_subtotal numeric;
  v_contingency numeric;
  v_markup numeric;
  v_taxable numeric;
  v_grand_total numeric;
  v_notes text;
begin
  if (select auth.uid()) is null
     or not public.is_staff((select auth.uid())) then
    raise exception 'Staff access required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
  ) then
    raise exception 'Project not found or unavailable'
      using errcode = 'P0002';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one estimate line item is required'
      using errcode = '22023';
  end if;

  if p_markup_pct < 0 or p_markup_pct > 100
     or p_contingency_pct < 0 or p_contingency_pct > 100
     or p_tax_pct < 0 or p_tax_pct > 100 then
    raise exception 'Percentages must be between 0 and 100'
      using errcode = '22023';
  end if;

  if not public.has_entitlement('estimates_core') then
    raise exception 'Estimate subscription required'
      using errcode = '42501';
  end if;

  if 'rendering' = any(coalesce(p_deliverables, '{}'::text[]))
     and not public.has_entitlement('shared_vision_rendering') then
    raise exception 'Shared Vision rendering subscription required'
      using errcode = '42501';
  end if;

  if 'concept_plan' = any(coalesce(p_deliverables, '{}'::text[]))
     and not public.has_entitlement('concept_plans') then
    raise exception 'Concept plan subscription required'
      using errcode = '42501';
  end if;

  if 'walkthrough_3d' = any(coalesce(p_deliverables, '{}'::text[]))
     and not public.has_entitlement('walkthrough_3d') then
    raise exception '3D walkthrough subscription required'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      category text,
      description text,
      quantity numeric,
      unit text,
      unit_cost numeric
    )
    where item.category not in (
      'labor', 'material', 'equipment', 'subcontractor',
      'fuel_travel', 'permit', 'disposal', 'contingency',
      'markup', 'other'
    )
       or nullif(btrim(item.description), '') is null
       or item.quantity is null
       or item.quantity <= 0
       or nullif(btrim(item.unit), '') is null
       or item.unit_cost is null
       or item.unit_cost < 0
  ) then
    raise exception 'One or more estimate line items are invalid'
      using errcode = '22023';
  end if;

  select coalesce(sum(item.quantity * item.unit_cost), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(
    category text,
    description text,
    quantity numeric,
    unit text,
    unit_cost numeric
  );

  v_contingency := v_subtotal * p_contingency_pct / 100;
  v_markup := v_subtotal * p_markup_pct / 100;
  v_taxable := v_subtotal + v_contingency + v_markup;
  v_grand_total := v_taxable + (v_taxable * p_tax_pct / 100);

  v_notes := concat_ws(
    E'\n',
    nullif(btrim(p_scope_notes), ''),
    case
      when coalesce(array_length(p_deliverables, 1), 0) > 0
      then 'Requested deliverables: ' || array_to_string(p_deliverables, ', ')
    end
  );

  insert into public.estimates (
    project_id,
    status,
    notes,
    markup_pct,
    contingency_pct,
    tax_pct,
    subtotal,
    grand_total,
    created_by
  )
  values (
    p_project_id,
    'draft',
    nullif(v_notes, ''),
    p_markup_pct,
    p_contingency_pct,
    p_tax_pct,
    v_subtotal,
    v_grand_total,
    (select auth.uid())
  )
  returning id into v_estimate_id;

  insert into public.estimate_line_items (
    estimate_id,
    category,
    description,
    quantity,
    unit,
    unit_cost,
    sort_order
  )
  select
    v_estimate_id,
    item.category::public.estimate_category,
    btrim(item.description),
    item.quantity,
    btrim(item.unit),
    item.unit_cost,
    entry.ordinality::integer - 1
  from jsonb_array_elements(p_items)
    with ordinality as entry(value, ordinality)
  cross join lateral jsonb_to_record(entry.value) as item(
    category text,
    description text,
    quantity numeric,
    unit text,
    unit_cost numeric
  );

  if 'rendering' = any(coalesce(p_deliverables, '{}'::text[])) then
    insert into public.concept_requests (
      project_id, title, prompt, status, created_by
    )
    values (
      p_project_id,
      'Shared Vision rendering',
      'Generate a realistic rendering from the approved field capture, measurements, scope, and client vision.',
      'draft',
      (select auth.uid())
    );
  end if;

  if 'concept_plan' = any(coalesce(p_deliverables, '{}'::text[])) then
    insert into public.concept_requests (
      project_id, title, prompt, status, created_by
    )
    values (
      p_project_id,
      'Concept plan / preliminary blueprint package',
      'Create dimension-aware concept plans and a preliminary blueprint package. Label for design review; local permit, architect, or engineer approval may be required.',
      'draft',
      (select auth.uid())
    );
  end if;

  if 'walkthrough_3d' = any(coalesce(p_deliverables, '{}'::text[])) then
    insert into public.concept_requests (
      project_id, title, prompt, status, created_by
    )
    values (
      p_project_id,
      'Subscriber 3D walkthrough',
      'Create an interactive 3D walkthrough that reinforces the approved Shared Vision. This is a visualization and not a sealed construction document.',
      'draft',
      (select auth.uid())
    );
  end if;

  return v_estimate_id;
end;
$function$;

revoke all on function public.create_estimate_builder_draft(
  uuid, jsonb, text, numeric, numeric, numeric, text[]
) from public, anon;

grant execute on function public.create_estimate_builder_draft(
  uuid, jsonb, text, numeric, numeric, numeric, text[]
) to authenticated, service_role;

comment on function public.create_estimate_builder_draft(
  uuid, jsonb, text, numeric, numeric, numeric, text[]
) is 'Atomically creates one staff-authorized estimate draft, its line items, and requested Shared Vision concept records.';
