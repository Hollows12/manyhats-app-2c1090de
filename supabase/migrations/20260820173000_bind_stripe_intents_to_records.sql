-- Bind every successful Stripe intent to the exact receivable and amount that
-- the application authorized before a webhook may mutate financial records.
create table if not exists public.stripe_payment_attempts (
  intent_id text primary key,
  target_type text not null check (target_type in ('invoice', 'deposit')),
  target_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  expected_amount_cents bigint not null check (expected_amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_payment_attempts enable row level security;
revoke all on public.stripe_payment_attempts from anon, authenticated;
grant all on public.stripe_payment_attempts to service_role;

create index if not exists stripe_payment_attempts_target_idx
  on public.stripe_payment_attempts (target_type, target_id, created_at desc);
