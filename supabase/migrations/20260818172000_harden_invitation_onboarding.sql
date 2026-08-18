-- Make staff onboarding invitation-only after the initial owner bootstrap.
-- Invitation lookup is server-authoritative; user-editable metadata is used only
-- to present the opaque token for validation against the invitations table.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role_count integer;
  _invite public.invitations%rowtype;
  _invite_token text := nullif(new.raw_user_meta_data ->> 'invite_token', '');
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );

  lock table public.user_roles in share row exclusive mode;

  select count(*)
  into _role_count
  from public.user_roles;

  if _role_count = 0 then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role);
  elsif _invite_token is not null then
    select *
    into _invite
    from public.invitations
    where token = _invite_token
      and accepted_at is null
      and expires_at >= now()
      and lower(email) = lower(new.email)
    for update;

    if found then
      insert into public.user_roles (user_id, role)
      values (new.id, _invite.role);

      update public.invitations
      set accepted_at = now(),
          accepted_by = new.id,
          updated_at = now()
      where id = _invite.id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
from public, anon, authenticated;

create or replace function public.can_bootstrap_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.user_roles);
$$;

revoke all on function public.can_bootstrap_owner()
from public, anon, authenticated;
grant execute on function public.can_bootstrap_owner()
to anon, authenticated;

create or replace function public.accept_invitation(_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite public.invitations%rowtype;
  _user_id uuid := auth.uid();
  _user_email text;
begin
  if _user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  select email
  into _user_email
  from auth.users
  where id = _user_id;

  select *
  into _invite
  from public.invitations
  where token = _token
  for update;

  if not found then
    raise exception 'Invitation not found'
      using errcode = 'P0002';
  end if;

  if _invite.accepted_at is not null then
    if _invite.accepted_by = _user_id then
      return jsonb_build_object('ok', true, 'role', _invite.role, 'already_accepted', true);
    end if;
    raise exception 'Invitation already accepted'
      using errcode = '23514';
  end if;

  if _invite.expires_at < now() then
    raise exception 'Invitation expired'
      using errcode = '22023';
  end if;

  if lower(_invite.email) <> lower(_user_email) then
    raise exception 'Invitation email does not match your account'
      using errcode = '42501';
  end if;

  delete from public.user_roles
  where user_id = _user_id;

  insert into public.user_roles (user_id, role)
  values (_user_id, _invite.role);

  update public.invitations
  set accepted_at = now(),
      accepted_by = _user_id,
      updated_at = now()
  where id = _invite.id;

  return jsonb_build_object('ok', true, 'role', _invite.role, 'already_accepted', false);
end;
$$;

revoke all on function public.accept_invitation(text)
from public, anon, authenticated;
grant execute on function public.accept_invitation(text)
to authenticated;
