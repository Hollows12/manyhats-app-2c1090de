-- Close validated V1 authorization gaps before device acceptance testing.
--
-- 1. A signed-in user may edit their own contact fields, but may not attach
--    their profile to a different client record. Admin/service operations keep
--    the ability to assign client_id.
-- 2. Client-file PIN attempts are serialized and enforced by both the verify
--    and data-returning RPCs, so callers cannot bypass the per-share lockout.
-- 3. Invitation previews stop disclosing PII after acceptance or expiry.

create or replace function public.protect_profile_client_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.has_role(
       (select auth.uid()),
       'admin'::public.app_role
     ) then
    if tg_op = 'INSERT' and new.client_id is not null then
      raise exception 'client assignment requires an administrator'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
       and new.client_id is distinct from old.client_id then
      raise exception 'client assignment requires an administrator'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_client_assignment()
from public, anon, authenticated;

drop trigger if exists protect_profile_client_assignment
on public.profiles;

create trigger protect_profile_client_assignment
before insert or update of client_id on public.profiles
for each row execute function public.protect_profile_client_assignment();

create or replace function public.portal_verify_client_file_pin(
  _token text,
  _pin text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  sh public.client_file_shares%rowtype;
  _attempts integer;
begin
  if _token is null or length(_token) < 16 then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if _pin is null or _pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('error', 'invalid_pin_format');
  end if;

  select * into sh
  from public.client_file_shares
  where token = _token
  for update;

  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if sh.revoked_at is not null then return jsonb_build_object('error', 'revoked'); end if;
  if sh.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if sh.pin_locked_until is not null and sh.pin_locked_until > now() then
    return jsonb_build_object('error', 'locked', 'until', sh.pin_locked_until);
  end if;

  if extensions.crypt(_pin, sh.pin_hash) = sh.pin_hash then
    update public.client_file_shares
    set pin_verified_at = coalesce(pin_verified_at, now()),
        pin_attempts = 0,
        pin_locked_until = null,
        updated_at = now()
    where id = sh.id;
    return jsonb_build_object('ok', true);
  end if;

  _attempts := coalesce(sh.pin_attempts, 0) + 1;
  update public.client_file_shares
  set pin_attempts = _attempts,
      pin_locked_until = case
        when _attempts >= 5 then now() + interval '30 minutes'
        else null
      end,
      updated_at = now()
  where id = sh.id;

  return jsonb_build_object(
    'error', 'wrong_pin',
    'attempts_left', greatest(0, 5 - _attempts)
  );
end;
$$;

revoke all on function public.portal_verify_client_file_pin(text, text)
from public, anon, authenticated;
grant execute on function public.portal_verify_client_file_pin(text, text)
to anon, authenticated, service_role;

create or replace function public.portal_get_client_file(
  _token text,
  _pin text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  sh public.client_file_shares%rowtype;
  proj public.projects%rowtype;
  cli public.clients%rowtype;
  photos jsonb;
  estimates jsonb;
  proposals jsonb;
  invoices jsonb;
  payments jsonb;
  change_orders jsonb;
  signatures jsonb;
  _attempts integer;
begin
  if _token is null or length(_token) < 16 then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if _pin is null or _pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('error', 'pin_required');
  end if;

  select * into sh
  from public.client_file_shares
  where token = _token
  for update;

  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if sh.revoked_at is not null then return jsonb_build_object('error', 'revoked'); end if;
  if sh.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if sh.pin_locked_until is not null and sh.pin_locked_until > now() then
    return jsonb_build_object('error', 'locked', 'until', sh.pin_locked_until);
  end if;

  if extensions.crypt(_pin, sh.pin_hash) <> sh.pin_hash then
    _attempts := coalesce(sh.pin_attempts, 0) + 1;
    update public.client_file_shares
    set pin_attempts = _attempts,
        pin_locked_until = case
          when _attempts >= 5 then now() + interval '30 minutes'
          else null
        end,
        updated_at = now()
    where id = sh.id;
    return jsonb_build_object(
      'error', 'wrong_pin',
      'attempts_left', greatest(0, 5 - _attempts)
    );
  end if;

  update public.client_file_shares
  set pin_verified_at = coalesce(pin_verified_at, now()),
      pin_attempts = 0,
      pin_locked_until = null,
      view_count = view_count + 1,
      last_viewed_at = now(),
      updated_at = now()
  where id = sh.id;

  select * into proj from public.projects where id = sh.project_id;
  if not found then return jsonb_build_object('error', 'project_missing'); end if;
  select * into cli from public.clients where id = proj.client_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'storage_path', p.storage_path, 'caption', p.caption,
    'phase', p.phase, 'captured_at', p.captured_at
  ) order by p.captured_at desc), '[]'::jsonb)
  into photos from public.project_photos p
  where p.project_id = sh.project_id and p.is_client_facing = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'grand_total', e.grand_total, 'status', e.status,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into estimates from public.estimates e where e.project_id = sh.project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pr.id, 'proposal_number', pr.proposal_number, 'status', pr.status,
    'sent_at', pr.sent_at, 'approved_at', pr.approved_at,
    'scope_of_work', pr.scope_of_work,
    'warranty_length', pr.warranty_length, 'warranty_notes', pr.warranty_notes,
    'exclusions', pr.exclusions, 'payment_terms', pr.payment_terms
  ) order by pr.created_at desc), '[]'::jsonb)
  into proposals from public.proposals pr where pr.project_id = sh.project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'invoice_number', i.invoice_number, 'total', i.total,
    'balance_due', i.balance_due, 'status', i.status,
    'invoice_date', i.invoice_date, 'due_date', i.due_date
  ) order by i.invoice_date desc), '[]'::jsonb)
  into invoices from public.invoices i
  where i.project_id = sh.project_id and i.status <> 'void';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'amount', p.amount, 'payment_date', p.payment_date,
    'method', p.method
  ) order by p.payment_date desc), '[]'::jsonb)
  into payments from public.payments p
  join public.invoices i on i.id = p.invoice_id
  where i.project_id = sh.project_id and p.is_void = false;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', co.id, 'description', co.description, 'amount', co.amount,
    'status', co.status, 'created_at', co.created_at
  ) order by co.created_at desc), '[]'::jsonb)
  into change_orders from public.change_orders co
  where co.project_id = sh.project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'signer_name', s.signer_name, 'signed_at', s.created_at,
    'proposal_id', s.proposal_id
  ) order by s.created_at desc), '[]'::jsonb)
  into signatures from public.proposal_signatures s
  join public.proposals pr on pr.id = s.proposal_id
  where pr.project_id = sh.project_id;

  insert into public.client_file_share_views(share_id) values (sh.id);

  return jsonb_build_object(
    'project', jsonb_build_object(
      'name', proj.name, 'address', proj.job_address,
      'city', proj.city, 'state', proj.state, 'zip', proj.zip,
      'description', proj.description
    ),
    'client', jsonb_build_object(
      'name', cli.name, 'email', cli.email, 'phone', cli.phone
    ),
    'photos', photos,
    'estimates', estimates,
    'proposals', proposals,
    'invoices', invoices,
    'payments', payments,
    'change_orders', change_orders,
    'signatures', signatures,
    'share', jsonb_build_object(
      'expires_at', sh.expires_at,
      'view_count', sh.view_count + 1
    )
  );
end;
$$;

revoke all on function public.portal_get_client_file(text, text)
from public, anon, authenticated;
grant execute on function public.portal_get_client_file(text, text)
to anon, authenticated, service_role;

create or replace function public.get_invitation_preview(_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', email,
    'role', role,
    'expires_at', expires_at
  )
  from public.invitations
  where token = _token
    and accepted_at is null
    and expires_at >= now();
$$;

revoke all on function public.get_invitation_preview(text)
from public, anon, authenticated;
grant execute on function public.get_invitation_preview(text)
to anon, authenticated, service_role;

comment on function public.can_bootstrap_owner()
is 'Intentional anonymous read-only bootstrap-state check. Actual first-owner assignment is serialized by handle_new_user with a table lock.';

comment on function public.get_invitation_preview(text)
is 'Intentional anonymous token-scoped preview. Returns only active, unaccepted invitations and omits acceptance metadata.';

comment on function public.portal_get_client_file(text, text)
is 'Intentional anonymous token-and-PIN client portal. Enforces serialized five-attempt per-share lockout before returning client-safe project data.';
