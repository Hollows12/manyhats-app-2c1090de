create table if not exists public.crew_labor_rates (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  hourly_pay numeric not null default 25,
  labor_burden_pct numeric not null default 20,
  billing_rate numeric,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_labor_rates_employee_name_nonempty
    check (nullif(btrim(employee_name), '') is not null),
  constraint crew_labor_rates_hourly_pay_nonnegative
    check (hourly_pay >= 0),
  constraint crew_labor_rates_burden_range
    check (labor_burden_pct between 0 and 200),
  constraint crew_labor_rates_billing_nonnegative
    check (billing_rate is null or billing_rate >= 0)
);

alter table public.crew_labor_rates enable row level security;
grant select, insert, update, delete on public.crew_labor_rates
to authenticated, service_role;

drop policy if exists "Staff manage crew labor rates"
on public.crew_labor_rates;
create policy "Staff manage crew labor rates"
on public.crew_labor_rates for all to authenticated
using (public.is_staff((select auth.uid())))
with check (
  public.is_staff((select auth.uid()))
  and created_by = (select auth.uid())
);

create index if not exists idx_crew_labor_rates_created_by
on public.crew_labor_rates (created_by);
create index if not exists idx_crew_labor_rates_active
on public.crew_labor_rates (active)
where active;

alter table public.proposal_options
  add column if not exists estimated_material_cost numeric not null default 0,
  add column if not exists estimated_labor_hours numeric not null default 0,
  add column if not exists labor_cost_rate numeric not null default 25,
  add column if not exists labor_burden_pct numeric not null default 20,
  add column if not exists estimated_other_cost numeric not null default 0,
  add column if not exists overhead_pct numeric not null default 10,
  add column if not exists target_margin_pct numeric not null default 20,
  add column if not exists promotion_label text,
  add column if not exists promotion_discount_pct numeric not null default 0,
  add column if not exists estimated_days numeric,
  add column if not exists pricing_source_summary text,
  add column if not exists pricing_checked_at timestamptz;

alter table public.proposal_options
  drop constraint if exists proposal_options_internal_costs_nonnegative,
  add constraint proposal_options_internal_costs_nonnegative check (
    estimated_material_cost >= 0
    and estimated_labor_hours >= 0
    and labor_cost_rate >= 0
    and estimated_other_cost >= 0
    and (estimated_days is null or estimated_days >= 0)
  ),
  drop constraint if exists proposal_options_internal_percentages,
  add constraint proposal_options_internal_percentages check (
    labor_burden_pct between 0 and 200
    and overhead_pct between 0 and 100
    and target_margin_pct between 0 and 95
    and promotion_discount_pct between 0 and 100
  );

comment on table public.crew_labor_rates is
  'Staff-only employee and crew planning rates; $25/hour is the V1 fallback when no rate is entered.';
comment on column public.proposal_options.estimated_material_cost is
  'Contractor-only estimated material cost; excluded from portal payloads.';
comment on column public.proposal_options.target_margin_pct is
  'Contractor-only target gross margin used to calculate the client price.';