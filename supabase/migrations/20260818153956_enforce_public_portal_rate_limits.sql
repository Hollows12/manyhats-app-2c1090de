create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticator, service_role;

create table private.portal_rate_limits (
  client_hash text not null,
  request_path text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  last_request_at timestamptz not null default pg_catalog.now(),
  primary key (client_hash, request_path, window_started_at)
);

alter table private.portal_rate_limits enable row level security;
revoke all on table private.portal_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.portal_rate_limits to service_role;

create or replace function private.check_portal_rate_limit()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  req_method text := pg_catalog.current_setting('request.method', true);
  req_path text := pg_catalog.ltrim(
    coalesce(pg_catalog.current_setting('request.path', true), ''),
    '/'
  );
  req_headers jsonb := coalesce(
    nullif(pg_catalog.current_setting('request.headers', true), ''),
    '{}'
  )::jsonb;
  client_ip text;
  request_client_hash text;
  bucket_start timestamptz;
  allowed_requests integer;
  current_count integer;
begin
  if req_method is null or req_method <> 'POST' then
    return;
  end if;

  if req_path not in (
    'rpc/get_invitation_preview',
    'rpc/portal_accept_proposal',
    'rpc/portal_get_client_file',
    'rpc/portal_get_invoice',
    'rpc/portal_get_proposal',
    'rpc/portal_mark_invoice_viewed',
    'rpc/portal_mark_proposal_viewed',
    'rpc/portal_verify_client_file_pin'
  ) then
    return;
  end if;

  client_ip := coalesce(
    nullif(
      pg_catalog.btrim(
        pg_catalog.split_part(req_headers->>'x-forwarded-for', ',', 1)
      ),
      ''
    ),
    'missing-forwarded-client'
  );

  request_client_hash := pg_catalog.encode(
    extensions.digest(client_ip, 'sha256'),
    'hex'
  );

  bucket_start :=
    pg_catalog.date_trunc('hour', pg_catalog.now())
    + (
      pg_catalog.floor(
        pg_catalog.date_part('minute', pg_catalog.now()) / 5
      ) * interval '5 minutes'
    );

  allowed_requests := case req_path
    when 'rpc/portal_accept_proposal' then 10
    when 'rpc/portal_verify_client_file_pin' then 20
    else 120
  end;

  insert into private.portal_rate_limits (
    client_hash,
    request_path,
    window_started_at,
    request_count,
    last_request_at
  )
  values (
    request_client_hash,
    req_path,
    bucket_start,
    1,
    pg_catalog.now()
  )
  on conflict (client_hash, request_path, window_started_at)
  do update set
    request_count = private.portal_rate_limits.request_count + 1,
    last_request_at = excluded.last_request_at
  returning request_count into current_count;

  if current_count > allowed_requests then
    raise sqlstate 'PGRST' using
      message = pg_catalog.jsonb_build_object(
        'code', 'portal_rate_limited',
        'message', 'Too many portal requests. Try again shortly.'
      )::text,
      detail = pg_catalog.jsonb_build_object(
        'status', 429,
        'headers', pg_catalog.jsonb_build_object('Retry-After', '300')
      )::text;
  end if;

  if pg_catalog.random() < 0.01 then
    delete from private.portal_rate_limits
    where window_started_at < pg_catalog.now() - interval '1 day';
  end if;
end;
$function$;

revoke all on function private.check_portal_rate_limit() from public, anon, authenticated;
grant execute on function private.check_portal_rate_limit() to authenticator, service_role;

alter role authenticator
  set pgrst.db_pre_request = 'private.check_portal_rate_limit';

notify pgrst, 'reload config';
