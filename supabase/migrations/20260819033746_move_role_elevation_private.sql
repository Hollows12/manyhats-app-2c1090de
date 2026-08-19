-- Keep the SECURITY DEFINER boundary outside the exposed API schema.
-- The public wrapper remains SECURITY INVOKER and preserves existing RLS references.

create or replace function private.has_role(
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

revoke all on function private.has_role(uuid, public.app_role)
from public, anon, authenticated;

grant execute on function private.has_role(uuid, public.app_role)
to authenticated, service_role;

grant usage on schema private to authenticated;

comment on function private.has_role(uuid, public.app_role)
is 'Self-scoped role lookup used by public RLS helpers without exposing a SECURITY DEFINER RPC.';

create or replace function public.has_role(
  _user_id uuid,
  _role public.app_role
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_role(_user_id, _role);
$$;

revoke all on function public.has_role(uuid, public.app_role)
from public, anon, authenticated;

grant execute on function public.has_role(uuid, public.app_role)
to authenticated, service_role;

comment on function public.has_role(uuid, public.app_role)
is 'SECURITY INVOKER wrapper for the private, self-scoped role lookup used by RLS.';
