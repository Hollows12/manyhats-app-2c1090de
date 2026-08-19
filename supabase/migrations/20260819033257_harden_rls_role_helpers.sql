-- Restore authenticated execution for the role helpers used by RLS policies.
-- Bind every lookup to auth.uid() so callers cannot inspect another user's role.

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
is 'Self-scoped role lookup for authenticated RLS evaluation. SECURITY DEFINER avoids recursive user_roles policy evaluation.';

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(_user_id = (select auth.uid()), false)
    and exists (
      select 1
      from public.user_roles
      where user_id = _user_id
        and role in ('admin'::public.app_role, 'crew'::public.app_role)
    );
$$;

revoke all on function public.is_staff(uuid)
from public, anon, authenticated;

grant execute on function public.is_staff(uuid)
to authenticated, service_role;

comment on function public.is_staff(uuid)
is 'Self-scoped staff lookup for authenticated RLS evaluation.';
