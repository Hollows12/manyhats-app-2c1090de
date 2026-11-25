-- Company pricing defaults are deliberately blank until an administrator
-- enters and confirms the business's actual numbers. The audit table records
-- every change, while quote snapshots preserve the values used at approval.

create table public.company_operating_defaults (
  id uuid primary key default gen_random_uuid(),
  settings_key text not null unique default 'primary'
    check (settings_key = 'primary'),
  labor_cost_rate numeric(12, 2),
  labor_burden_pct numeric(7, 2),
  crew_size integer,
  equipment_cost_per_hour numeric(12, 2),
  travel_cost_per_mile numeric(12, 2),
  disposal_cost_per_load numeric(12, 2),
  permit_allowance numeric(12, 2),
  overhead_pct numeric(7, 2),
  contingency_pct numeric(7, 2),
  target_margin_pct numeric(7, 2),
  veteran_discount_pct numeric(7, 2),
  confirmed_fields text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_operating_defaults_nonnegative check (
    (labor_cost_rate is null or labor_cost_rate >= 0)
    and (crew_size is null or crew_size between 1 and 500)
    and (equipment_cost_per_hour is null or equipment_cost_per_hour >= 0)
    and (travel_cost_per_mile is null or travel_cost_per_mile >= 0)
    and (disposal_cost_per_load is null or disposal_cost_per_load >= 0)
    and (permit_allowance is null or permit_allowance >= 0)
  ),
  constraint company_operating_defaults_percentages check (
    (labor_burden_pct is null or labor_burden_pct between 0 and 200)
    and (overhead_pct is null or overhead_pct between 0 and 100)
    and (contingency_pct is null or contingency_pct between 0 and 100)
    and (target_margin_pct is null or target_margin_pct between 0 and 95)
    and (veteran_discount_pct is null or veteran_discount_pct between 0 and 100)
  ),
  constraint company_operating_defaults_confirmable_fields check (
    confirmed_fields <@ array[
      'labor_cost_rate', 'labor_burden_pct', 'crew_size',
      'equipment_cost_per_hour', 'travel_cost_per_mile',
      'disposal_cost_per_load', 'permit_allowance', 'overhead_pct',
      'contingency_pct', 'target_margin_pct', 'veteran_discount_pct'
    ]::text[]
    and ('labor_cost_rate' <> all(confirmed_fields) or labor_cost_rate is not null)
    and ('labor_burden_pct' <> all(confirmed_fields) or labor_burden_pct is not null)
    and ('crew_size' <> all(confirmed_fields) or crew_size is not null)
    and ('equipment_cost_per_hour' <> all(confirmed_fields) or equipment_cost_per_hour is not null)
    and ('travel_cost_per_mile' <> all(confirmed_fields) or travel_cost_per_mile is not null)
    and ('disposal_cost_per_load' <> all(confirmed_fields) or disposal_cost_per_load is not null)
    and ('permit_allowance' <> all(confirmed_fields) or permit_allowance is not null)
    and ('overhead_pct' <> all(confirmed_fields) or overhead_pct is not null)
    and ('contingency_pct' <> all(confirmed_fields) or contingency_pct is not null)
    and ('target_margin_pct' <> all(confirmed_fields) or target_margin_pct is not null)
    and ('veteran_discount_pct' <> all(confirmed_fields) or veteran_discount_pct is not null)
  )
);

alter table public.company_operating_defaults enable row level security;
grant select on public.company_operating_defaults to authenticated;
grant update on public.company_operating_defaults to authenticated;
grant all on public.company_operating_defaults to service_role;

create policy company_operating_defaults_staff_read
on public.company_operating_defaults for select to authenticated
using (public.is_staff((select auth.uid())));

create policy company_operating_defaults_admin_update
on public.company_operating_defaults for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  and settings_key = 'primary'
);

create table public.company_operating_defaults_history (
  id uuid primary key default gen_random_uuid(),
  settings_id uuid not null references public.company_operating_defaults(id) on delete restrict,
  operation text not null check (operation in ('insert', 'update')),
  before_values jsonb,
  after_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index company_operating_defaults_history_changed_at_idx
  on public.company_operating_defaults_history (settings_id, changed_at desc);
alter table public.company_operating_defaults_history enable row level security;
revoke all on table public.company_operating_defaults_history from public, anon, authenticated;
grant select on public.company_operating_defaults_history to authenticated;
grant all on public.company_operating_defaults_history to service_role;

create policy company_operating_defaults_history_staff_read
on public.company_operating_defaults_history for select to authenticated
using (public.is_staff((select auth.uid())));

create or replace function public.audit_company_operating_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_operating_defaults_history (
    settings_id, operation, before_values, after_values, changed_by
  ) values (
    new.id,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'id' - 'created_at' else null end,
    to_jsonb(new) - 'id' - 'created_at',
    auth.uid()
  );
  return new;
end;
$$;

revoke all on function public.audit_company_operating_defaults()
  from public, anon, authenticated;

create trigger company_operating_defaults_audit_insert
after insert on public.company_operating_defaults
for each row execute function public.audit_company_operating_defaults();

create trigger company_operating_defaults_audit_update
after update on public.company_operating_defaults
for each row
when (
  old.labor_cost_rate is distinct from new.labor_cost_rate
  or old.labor_burden_pct is distinct from new.labor_burden_pct
  or old.crew_size is distinct from new.crew_size
  or old.equipment_cost_per_hour is distinct from new.equipment_cost_per_hour
  or old.travel_cost_per_mile is distinct from new.travel_cost_per_mile
  or old.disposal_cost_per_load is distinct from new.disposal_cost_per_load
  or old.permit_allowance is distinct from new.permit_allowance
  or old.overhead_pct is distinct from new.overhead_pct
  or old.contingency_pct is distinct from new.contingency_pct
  or old.target_margin_pct is distinct from new.target_margin_pct
  or old.veteran_discount_pct is distinct from new.veteran_discount_pct
  or old.confirmed_fields is distinct from new.confirmed_fields
)
execute function public.audit_company_operating_defaults();

create or replace function public.touch_company_operating_defaults()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.touch_company_operating_defaults()
  from public, anon, authenticated;

create trigger company_operating_defaults_touch_updated_at
before update on public.company_operating_defaults
for each row execute function public.touch_company_operating_defaults();

insert into public.company_operating_defaults (settings_key)
values ('primary');

alter table public.proposal_options
  add column pricing_defaults_snapshot jsonb not null default '{}'::jsonb,
  add column pricing_warning_tags text[] not null default '{}';

comment on table public.company_operating_defaults is
  'Admin-managed company pricing inputs. Blank values are intentionally not treated as validated company costs.';
comment on table public.company_operating_defaults_history is
  'Append-only history of company pricing defaults changes.';
comment on column public.proposal_options.pricing_defaults_snapshot is
  'Company defaults and confirmation status captured when contractor pricing is saved; included in acceptance snapshots.';
comment on column public.proposal_options.pricing_warning_tags is
  'Pricing inputs that were missing or unconfirmed when contractor pricing was saved.';
