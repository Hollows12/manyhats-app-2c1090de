
create table public.subscription_plans (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_entitlements (
  plan_key text not null references public.subscription_plans(key) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]*$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (plan_key, feature_key)
);

create table public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null references public.subscription_plans(key),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','canceled','expired')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_subscriptions_provider_subscription_uidx
  on public.user_subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create table public.user_entitlement_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]*$'),
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

alter table public.subscription_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_entitlement_overrides enable row level security;

create policy subscription_plans_authenticated_read on public.subscription_plans
  for select to authenticated using (active = true or public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy plan_entitlements_authenticated_read on public.plan_entitlements
  for select to authenticated using (true);
create policy user_subscriptions_self_or_admin_read on public.user_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy user_entitlement_overrides_self_or_admin_read on public.user_entitlement_overrides
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role));

revoke all on public.subscription_plans, public.plan_entitlements,
  public.user_subscriptions, public.user_entitlement_overrides from public, anon, authenticated;
grant select on public.subscription_plans, public.plan_entitlements,
  public.user_subscriptions, public.user_entitlement_overrides to authenticated;
grant all on public.subscription_plans, public.plan_entitlements,
  public.user_subscriptions, public.user_entitlement_overrides to service_role;

insert into public.subscription_plans(key,display_name,monthly_price_cents) values
 ('starter','Starter',0),('pro','Pro',4900),('business','Business',9900),('enterprise','Enterprise',19900);

insert into public.plan_entitlements(plan_key,feature_key) values
 ('starter','estimates_core'),('starter','material_takeoff'),('starter','proposal_attachments'),('starter','client_approval'),
 ('pro','estimates_core'),('pro','material_takeoff'),('pro','proposal_attachments'),('pro','client_approval'),
 ('pro','shared_vision_rendering'),('pro','concept_plans'),('pro','ai_generators'),
 ('business','estimates_core'),('business','material_takeoff'),('business','proposal_attachments'),('business','client_approval'),
 ('business','shared_vision_rendering'),('business','concept_plans'),('business','ai_generators'),
 ('business','walkthrough_3d'),('business','sentinel_septic'),
 ('enterprise','estimates_core'),('enterprise','material_takeoff'),('enterprise','proposal_attachments'),('enterprise','client_approval'),
 ('enterprise','shared_vision_rendering'),('enterprise','concept_plans'),('enterprise','ai_generators'),
 ('enterprise','walkthrough_3d'),('enterprise','sentinel_septic');

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
    and (current_period_start is null or current_period_start <= now())
    and (current_period_end is null or current_period_end > now());

  if _plan_key is null then return false; end if;

  return exists(select 1 from public.plan_entitlements
    where plan_key=_plan_key and feature_key=_feature_key and enabled=true);
end $$;

revoke all on function public.has_entitlement(text) from public, anon, authenticated;
grant execute on function public.has_entitlement(text) to authenticated, service_role;
comment on function public.has_entitlement(text) is
 'Authoritative V1 feature entitlement check. Admins receive all features; non-admin access requires an active/trialing subscription or explicit override.';

create index user_subscriptions_status_period_idx on public.user_subscriptions(status,current_period_end);
create index user_entitlement_overrides_expiry_idx on public.user_entitlement_overrides(expires_at) where expires_at is not null;
