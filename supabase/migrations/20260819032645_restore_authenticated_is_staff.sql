create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(_user_id = (select auth.uid()), false)
    and exists (
      select 1
      from public.user_roles
      where user_id = _user_id
        and role in ('admin', 'crew')
    );
$function$;

revoke all on function public.is_staff(uuid) from public, anon;

grant execute on function public.is_staff(uuid)
to authenticated, service_role;

comment on function public.is_staff(uuid) is
  'Returns whether the authenticated caller is staff. The argument must equal auth.uid(), preventing cross-user role enumeration.';