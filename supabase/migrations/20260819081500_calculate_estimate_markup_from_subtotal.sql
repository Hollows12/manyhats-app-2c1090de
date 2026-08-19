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