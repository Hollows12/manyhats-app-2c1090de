-- Cover entitlement foreign keys used by administrative joins and cleanup paths.
create index if not exists user_subscriptions_plan_key_idx
  on public.user_subscriptions (plan_key);

create index if not exists user_entitlement_overrides_created_by_idx
  on public.user_entitlement_overrides (created_by)
  where created_by is not null;
