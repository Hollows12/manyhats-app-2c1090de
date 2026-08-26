-- CloseCrew V1 shared tenant, entitlement, communications, automation and reporting core.
-- Deployment is intentionally approval-gated. Provider secrets remain server-side.

create schema if not exists private;

create type public.closecrew_member_role as enum ('owner','admin','manager','member');
create type public.closecrew_product as enum ('manyhats_pro','closecrew');
create type public.closecrew_subscription_status as enum ('trialing','active','grace','past_due','paused','canceled','expired');
create type public.closecrew_lead_state as enum (
  'new','contacted','awaiting_information','appointment_requested','estimate_being_prepared',
  'estimate_sent','follow_up_active','question_received','accepted','declined','no_response',
  'opted_out','converted_to_project','closed','archived'
);
create type public.closecrew_message_direction as enum ('inbound','outbound');
create type public.closecrew_message_status as enum ('scheduled','attempted','queued','sent','delivered','failed','received','suppressed','canceled');
create type public.closecrew_consent_status as enum ('unknown','consented','opted_out','wrong_number','reassigned','blocked');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  timezone text not null default 'America/New_York',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.closecrew_member_role not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index organization_memberships_user_idx on public.organization_memberships(user_id,organization_id) where active;

create table public.product_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product public.closecrew_product not null,
  status public.closecrew_subscription_status not null,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,product),
  constraint product_account_period_check check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create unique index product_accounts_provider_subscription_uidx on public.product_accounts(provider_subscription_id) where provider_subscription_id is not null;

create table public.organization_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^closecrew_[a-z0-9_]+$'),
  source_product public.closecrew_product not null,
  enabled boolean not null default true,
  fair_use_limit bigint check (fair_use_limit is null or fair_use_limit >= 0),
  effective_at timestamptz not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id,feature_key,source_product),
  constraint organization_entitlement_period_check check (expires_at is null or expires_at > effective_at)
);
create index organization_entitlements_lookup_idx on public.organization_entitlements(organization_id,feature_key,effective_at,expires_at) where enabled;

create table public.closecrew_rollouts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  audience text not null check (audience in ('off','internal','private_beta','eligible_plan','standalone')) default 'off',
  enabled boolean not null default false,
  prerequisites_valid boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.closecrew_phone_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check (provider_key ~ '^[a-z][a-z0-9_]*$'),
  provider_account_ref text not null,
  provider_number_ref text not null,
  e164_number text not null check (e164_number ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null check (status in ('pending','active','paused','disconnected')) default 'pending',
  business_hours jsonb not null default '{}'::jsonb,
  quiet_hours jsonb not null default '{"start":"20:00","end":"08:00"}'::jsonb,
  emergency_exclusions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_key,provider_number_ref),
  unique(organization_id,e164_number)
);

create table public.closecrew_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  normalized_phone text not null check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  display_phone text,
  name text,
  email text,
  service_address text,
  service_area text,
  consent_status public.closecrew_consent_status not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,normalized_phone)
);

create table public.closecrew_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  normalized_phone text not null check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  scope text not null check (scope in ('global','organization')),
  reason text not null check (reason in ('stop','blocked','wrong_number','reassigned','complaint','manual','prohibited_category')),
  source_message_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint closecrew_suppression_scope_check check ((scope='global' and organization_id is null) or (scope='organization' and organization_id is not null))
);
create unique index closecrew_suppression_unique_idx on public.closecrew_suppressions(coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),normalized_phone,scope);

create table public.closecrew_consent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.closecrew_contacts(id) on delete restrict,
  status public.closecrew_consent_status not null,
  legal_basis text,
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id)
);
create index closecrew_consent_events_contact_idx on public.closecrew_consent_events(organization_id,contact_id,occurred_at desc);

create table public.closecrew_provider_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null,
  provider_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  processed_at timestamptz,
  processing_error_code text,
  unique(provider_key,provider_event_id)
);

create table public.closecrew_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.closecrew_contacts(id) on delete restrict,
  source_event_id uuid references public.closecrew_provider_events(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assigned_to uuid references auth.users(id),
  state public.closecrew_lead_state not null default 'new',
  service_type text,
  description text,
  urgency text check (urgency is null or urgency in ('routine','soon','urgent','emergency_excluded')),
  preferred_times jsonb not null default '[]'::jsonb,
  source text,
  campaign text,
  estimated_value numeric check (estimated_value is null or estimated_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index closecrew_open_lead_contact_uidx on public.closecrew_leads(organization_id,contact_id) where state not in ('declined','converted_to_project','closed','archived');
create index closecrew_leads_org_state_idx on public.closecrew_leads(organization_id,state,updated_at desc);

create table public.closecrew_lead_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.closecrew_leads(id) on delete cascade,
  from_state public.closecrew_lead_state,
  to_state public.closecrew_lead_state not null,
  reason text,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

create table public.closecrew_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.closecrew_contacts(id) on delete restrict,
  lead_id uuid references public.closecrew_leads(id) on delete set null,
  provider_key text not null,
  provider_message_id text,
  idempotency_key text not null,
  direction public.closecrew_message_direction not null,
  status public.closecrew_message_status not null,
  template_version_id uuid,
  content_ciphertext text,
  content_digest text check (content_digest is null or content_digest ~ '^[a-f0-9]{64}$'),
  failure_code text,
  scheduled_for timestamptz,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id,idempotency_key),
  unique(provider_key,provider_message_id)
);
create index closecrew_messages_org_status_idx on public.closecrew_messages(organization_id,status,scheduled_for);

create table public.closecrew_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  version integer not null check (version > 0),
  purpose text not null check (purpose in ('missed_call','follow_up','help','review_request')),
  body text not null check (length(body) between 1 and 1600),
  approved boolean not null default false,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,template_key,version),
  constraint closecrew_template_approval_check check (not approved or (approved_by is not null and approved_at is not null))
);
alter table public.closecrew_messages add constraint closecrew_messages_template_version_fkey foreign key (template_version_id) references public.closecrew_template_versions(id) on delete restrict;

create table public.closecrew_sequences (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, active boolean not null default false, max_messages smallint not null default 3 check (max_messages between 1 and 6),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.closecrew_sequence_steps (
  id uuid primary key default gen_random_uuid(), sequence_id uuid not null references public.closecrew_sequences(id) on delete cascade,
  step_number smallint not null check (step_number between 1 and 6), delay_minutes integer not null check (delay_minutes between 15 and 43200),
  template_version_id uuid not null references public.closecrew_template_versions(id) on delete restrict,
  unique(sequence_id,step_number)
);
create table public.closecrew_enrollments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid not null references public.closecrew_sequences(id) on delete restrict, contact_id uuid not null references public.closecrew_contacts(id) on delete restrict,
  lead_id uuid references public.closecrew_leads(id) on delete set null, estimate_id uuid references public.estimates(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null, status text not null check (status in ('active','paused','completed','stopped')) default 'active',
  stop_reason text, started_at timestamptz not null default now(), next_action_at timestamptz, stopped_at timestamptz,
  constraint closecrew_enrollment_target_check check (num_nonnulls(lead_id,estimate_id,proposal_id) >= 1)
);
create unique index closecrew_active_enrollment_target_uidx on public.closecrew_enrollments(organization_id,sequence_id,coalesce(lead_id,estimate_id,proposal_id)) where status='active';

create table public.closecrew_review_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.closecrew_contacts(id) on delete restrict, project_id uuid not null references public.projects(id) on delete restrict,
  destination_url text not null, status text not null check (status in ('eligible','scheduled','sent','delivered','failed','suppressed','canceled')),
  idempotency_key text not null, created_at timestamptz not null default now(), sent_at timestamptz,
  unique(organization_id,project_id), unique(organization_id,idempotency_key)
);

create table public.closecrew_usage_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_key text not null, quantity bigint not null check (quantity > 0), provider_key text, idempotency_key text not null,
  occurred_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);
create index closecrew_usage_org_metric_idx on public.closecrew_usage_events(organization_id,metric_key,occurred_at);

create table public.closecrew_revenue_attributions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.closecrew_leads(id) on delete set null, project_id uuid references public.projects(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null, proposal_id uuid references public.proposals(id) on delete set null,
  deposit_id uuid references public.deposits(id) on delete set null, classification text not null check (classification in ('attributed','estimated','confirmed')),
  amount numeric not null check (amount >= 0), evidence_type text not null, evidence_id text, recorded_at timestamptz not null default now(),
  unique(organization_id,classification,evidence_type,evidence_id)
);

create table public.closecrew_audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null, entity_type text not null, entity_id uuid, actor_type text not null check (actor_type in ('user','system','provider')),
  actor_id uuid references auth.users(id), metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create index closecrew_audit_org_time_idx on public.closecrew_audit_events(organization_id,occurred_at desc);

create or replace function private.is_organization_member(_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id=_organization_id and m.user_id=(select auth.uid()) and m.active)
$$;
create or replace function private.is_organization_manager(_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id=_organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','admin','manager'))
$$;
revoke all on function private.is_organization_member(uuid), private.is_organization_manager(uuid) from public,anon,authenticated;
grant execute on function private.is_organization_member(uuid), private.is_organization_manager(uuid) to authenticated,service_role;

create or replace function public.closecrew_has_entitlement(_organization_id uuid,_feature_key text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (current_user in ('postgres','service_role','supabase_admin') or private.is_organization_member(_organization_id))
    and exists(select 1 from public.closecrew_rollouts r where r.organization_id=_organization_id and r.enabled and r.prerequisites_valid and r.audience <> 'off')
    and exists(
      select 1 from public.organization_entitlements e join public.product_accounts p
        on p.organization_id=e.organization_id and p.product=e.source_product
      where e.organization_id=_organization_id and e.feature_key=_feature_key and e.enabled
        and e.effective_at <= now() and (e.expires_at is null or e.expires_at > now())
        and (p.status in ('trialing','active') or (p.status in ('grace','past_due') and p.grace_until > now()))
    ), false)
$$;
revoke all on function public.closecrew_has_entitlement(uuid,text) from public,anon,authenticated;
grant execute on function public.closecrew_has_entitlement(uuid,text) to authenticated,service_role;

create or replace function public.closecrew_transition_lead(_lead_id uuid,_to_state public.closecrew_lead_state,_reason text default null)
returns public.closecrew_leads language plpgsql security invoker set search_path = '' as $$
declare _lead public.closecrew_leads; _allowed boolean; _from_state public.closecrew_lead_state;
begin
  select * into _lead from public.closecrew_leads where id=_lead_id for update;
  if not found or not private.is_organization_member(_lead.organization_id) or not public.closecrew_has_entitlement(_lead.organization_id,'closecrew_core') then raise exception 'forbidden' using errcode='42501'; end if;
  _allowed := case _lead.state
    when 'new' then _to_state in ('contacted','awaiting_information','appointment_requested','declined','opted_out','closed','archived')
    when 'contacted' then _to_state in ('awaiting_information','appointment_requested','estimate_being_prepared','question_received','declined','no_response','opted_out','closed')
    when 'awaiting_information' then _to_state in ('contacted','appointment_requested','estimate_being_prepared','question_received','no_response','opted_out','closed')
    when 'appointment_requested' then _to_state in ('contacted','estimate_being_prepared','question_received','declined','opted_out','closed')
    when 'estimate_being_prepared' then _to_state in ('estimate_sent','question_received','declined','opted_out','closed')
    when 'estimate_sent' then _to_state in ('follow_up_active','question_received','accepted','declined','no_response','opted_out','closed')
    when 'follow_up_active' then _to_state in ('question_received','accepted','declined','no_response','opted_out','converted_to_project','closed')
    when 'question_received' then _to_state in ('contacted','awaiting_information','appointment_requested','estimate_being_prepared','estimate_sent','accepted','declined','opted_out','closed')
    when 'accepted' then _to_state in ('converted_to_project','closed')
    when 'no_response' then _to_state in ('contacted','follow_up_active','question_received','closed','archived')
    when 'converted_to_project' then _to_state in ('closed','archived')
    when 'declined' then _to_state in ('contacted','closed','archived')
    when 'closed' then _to_state='archived'
    else false end;
  if not _allowed then raise exception 'invalid_closecrew_state_transition' using errcode='22023'; end if;
  _from_state := _lead.state;
  update public.closecrew_leads set state=_to_state,updated_at=now(),closed_at=case when _to_state in ('declined','closed','archived') then now() else closed_at end where id=_lead_id returning * into _lead;
  insert into public.closecrew_lead_transitions(organization_id,lead_id,from_state,to_state,reason,actor_id) values(_lead.organization_id,_lead.id,_from_state,_to_state,_reason,(select auth.uid()));
  if _to_state in ('question_received','accepted','declined','opted_out','converted_to_project','closed','archived') then
    update public.closecrew_enrollments set status='stopped',stop_reason=_to_state::text,stopped_at=now(),next_action_at=null where lead_id=_lead_id and status='active';
  end if;
  return _lead;
end $$;
revoke all on function public.closecrew_transition_lead(uuid,public.closecrew_lead_state,text) from public,anon,authenticated;
grant execute on function public.closecrew_transition_lead(uuid,public.closecrew_lead_state,text) to authenticated,service_role;

-- Immutable evidence and audit ledgers.
create or replace function private.closecrew_prevent_mutation() returns trigger language plpgsql security invoker set search_path='' as $$ begin raise exception 'immutable_closecrew_record' using errcode='42501'; end $$;
revoke all on function private.closecrew_prevent_mutation() from public,anon,authenticated;
create trigger closecrew_consent_events_immutable before update or delete on public.closecrew_consent_events for each row execute function private.closecrew_prevent_mutation();
create trigger closecrew_provider_events_immutable before delete on public.closecrew_provider_events for each row execute function private.closecrew_prevent_mutation();
create trigger closecrew_audit_events_immutable before update or delete on public.closecrew_audit_events for each row execute function private.closecrew_prevent_mutation();

-- Tenant RLS. Service workers use service_role; clients receive least privilege.
do $rls$
declare t text;
begin
  foreach t in array array['organizations','organization_memberships','product_accounts','organization_entitlements','closecrew_rollouts','closecrew_phone_connections','closecrew_contacts','closecrew_suppressions','closecrew_consent_events','closecrew_provider_events','closecrew_leads','closecrew_lead_transitions','closecrew_messages','closecrew_template_versions','closecrew_sequences','closecrew_sequence_steps','closecrew_enrollments','closecrew_review_requests','closecrew_usage_events','closecrew_revenue_attributions','closecrew_audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $rls$;

grant select on public.organizations,public.organization_memberships,public.product_accounts,public.organization_entitlements,public.closecrew_rollouts to authenticated;
grant select,insert,update on public.closecrew_phone_connections,public.closecrew_contacts,public.closecrew_leads,public.closecrew_template_versions,public.closecrew_sequences,public.closecrew_sequence_steps,public.closecrew_enrollments,public.closecrew_review_requests to authenticated;
grant select on public.closecrew_suppressions,public.closecrew_consent_events,public.closecrew_provider_events,public.closecrew_lead_transitions,public.closecrew_messages,public.closecrew_usage_events,public.closecrew_revenue_attributions,public.closecrew_audit_events to authenticated;

create policy organizations_member_select on public.organizations for select to authenticated using (private.is_organization_member(id));
create policy memberships_member_select on public.organization_memberships for select to authenticated using (private.is_organization_member(organization_id));
create policy product_accounts_member_select on public.product_accounts for select to authenticated using (private.is_organization_member(organization_id));
create policy organization_entitlements_member_select on public.organization_entitlements for select to authenticated using (private.is_organization_member(organization_id));
create policy closecrew_rollouts_member_select on public.closecrew_rollouts for select to authenticated using (private.is_organization_member(organization_id));

do $policies$
declare t text;
begin
  foreach t in array array['closecrew_phone_connections','closecrew_contacts','closecrew_leads','closecrew_template_versions','closecrew_sequences','closecrew_enrollments','closecrew_review_requests'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_organization_member(organization_id))',t||'_member_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_organization_manager(organization_id) and public.closecrew_has_entitlement(organization_id,''closecrew_core''))',t||'_manager_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_organization_manager(organization_id)) with check (private.is_organization_manager(organization_id) and public.closecrew_has_entitlement(organization_id,''closecrew_core''))',t||'_manager_update',t);
  end loop;
  foreach t in array array['closecrew_suppressions','closecrew_consent_events','closecrew_provider_events','closecrew_lead_transitions','closecrew_messages','closecrew_usage_events','closecrew_revenue_attributions','closecrew_audit_events'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_organization_member(organization_id))',t||'_member_select',t);
  end loop;
end $policies$;

create policy closecrew_sequence_steps_member_select on public.closecrew_sequence_steps for select to authenticated using (exists(select 1 from public.closecrew_sequences s where s.id=sequence_id and private.is_organization_member(s.organization_id)));
create policy closecrew_sequence_steps_manager_insert on public.closecrew_sequence_steps for insert to authenticated with check (exists(select 1 from public.closecrew_sequences s where s.id=sequence_id and private.is_organization_manager(s.organization_id) and public.closecrew_has_entitlement(s.organization_id,'closecrew_follow_up')));
create policy closecrew_sequence_steps_manager_update on public.closecrew_sequence_steps for update to authenticated using (exists(select 1 from public.closecrew_sequences s where s.id=sequence_id and private.is_organization_manager(s.organization_id))) with check (exists(select 1 from public.closecrew_sequences s where s.id=sequence_id and private.is_organization_manager(s.organization_id) and public.closecrew_has_entitlement(s.organization_id,'closecrew_follow_up')));

comment on table public.product_accounts is 'Stable organization product identity; ManyHats Pro and standalone CloseCrew may coexist without duplicate organizations or data copying.';
comment on table public.closecrew_provider_events is 'Idempotent provider-event envelope; raw provider payloads and secrets are intentionally not stored.';
comment on table public.closecrew_revenue_attributions is 'Separates correlated attribution, estimates, and payment/job-confirmed revenue.';
