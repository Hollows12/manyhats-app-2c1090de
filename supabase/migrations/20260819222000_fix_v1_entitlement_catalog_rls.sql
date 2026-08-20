-- Keep inactive plan catalogs hidden from non-admin users and align new
-- entitlement tables with the repository's updated_at trigger convention.

drop policy if exists plan_entitlements_authenticated_read
on public.plan_entitlements;

create policy plan_entitlements_authenticated_read on public.plan_entitlements
  for select to authenticated
  using (
    exists (
      select 1
      from public.subscription_plans sp
      where sp.key = plan_entitlements.plan_key
        and sp.active = true
    )
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create trigger trg_subscription_plans_updated
before update on public.subscription_plans
for each row execute function public.set_updated_at();

create trigger trg_user_subscriptions_updated
before update on public.user_subscriptions
for each row execute function public.set_updated_at();
