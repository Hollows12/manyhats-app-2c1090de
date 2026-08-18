-- Add a transactional, admin-only role-management boundary.
-- The invariant prevents the final administrator from being demoted.

create or replace function public.set_user_role(
  _target_user_id uuid,
  _role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller_id uuid := auth.uid();
  _target_is_admin boolean;
  _admin_count integer;
begin
  if _caller_id is null
     or not public.has_role(_caller_id, 'admin'::public.app_role) then
    raise exception 'Forbidden: admin only'
      using errcode = '42501';
  end if;

  if _target_user_id is null then
    raise exception 'Target user is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = _target_user_id
  ) then
    raise exception 'User not found'
      using errcode = 'P0002';
  end if;

  lock table public.user_roles in share row exclusive mode;

  select exists (
    select 1
    from public.user_roles
    where user_id = _target_user_id
      and role = 'admin'::public.app_role
  )
  into _target_is_admin;

  if _target_is_admin and _role <> 'admin'::public.app_role then
    select count(*)
    into _admin_count
    from public.user_roles
    where role = 'admin'::public.app_role;

    if _admin_count <= 1 then
      raise exception 'At least one administrator is required'
        using errcode = '23514';
    end if;
  end if;

  delete from public.user_roles
  where user_id = _target_user_id;

  insert into public.user_roles (user_id, role)
  values (_target_user_id, _role);
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role)
from public, anon, authenticated;

grant execute on function public.set_user_role(uuid, public.app_role)
to authenticated, service_role;

comment on function public.set_user_role(uuid, public.app_role)
is 'Admin-only atomic role replacement that preserves at least one administrator.';
