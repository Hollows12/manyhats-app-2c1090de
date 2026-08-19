-- Revert the private schema USAGE grant for authenticated users added in
-- 20260819033746_move_role_elevation_private.sql.  That grant undoes the
-- explicit `revoke all on schema private from ... authenticated` that was
-- put in place by 20260818153956_enforce_public_portal_rate_limits.sql to
-- protect private.portal_rate_limits and private.check_portal_rate_limit.
--
-- Even though each private object still has its own object-level REVOKE, a
-- schema-level grant means any future private object added without an
-- explicit REVOKE FROM authenticated becomes namespace-reachable by any
-- authenticated user, which violates the "private by default" contract of
-- the schema.
--
-- Fix: drop the private.has_role wrapper (no longer needed), restore
-- public.has_role as SECURITY DEFINER with set search_path = '' (safe
-- against search-path injection), and revoke the schema-level grant.

drop function if exists private.has_role(uuid, public.app_role);

revoke usage on schema private from authenticated;

create or replace function public.has_role(
  _user_id uuid,
  _role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(_user_id = (select auth.uid()), false)
    and exists (
      select 1
      from public.user_roles
      where user_id = _user_id
        and role = _role
    );
$$;

revoke all on function public.has_role(uuid, public.app_role)
from public, anon, authenticated;

grant execute on function public.has_role(uuid, public.app_role)
to authenticated, service_role;

comment on function public.has_role(uuid, public.app_role)
is 'Self-scoped SECURITY DEFINER role lookup used by RLS policies. set search_path = '''' guards against injection. The argument must equal auth.uid(), preventing cross-user role enumeration.';
