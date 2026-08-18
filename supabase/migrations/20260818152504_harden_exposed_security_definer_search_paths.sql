-- Harden intentionally exposed privileged functions with a fixed, minimal
-- search path that includes Supabase's pgcrypto extension schema. Reassert
-- exact caller grants so future default privileges cannot broaden execution.

alter function public.accept_invitation(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.accept_invitation(text) from public, anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated, service_role;

alter function public.create_client_file_share(uuid,text,integer,boolean)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.create_client_file_share(uuid,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.create_client_file_share(uuid,text,integer,boolean) to authenticated, service_role;

alter function public.ensure_invoice_portal_token(uuid,boolean)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.ensure_invoice_portal_token(uuid,boolean) from public, anon, authenticated;
grant execute on function public.ensure_invoice_portal_token(uuid,boolean) to authenticated, service_role;

alter function public.ensure_proposal_portal_token(uuid,boolean)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.ensure_proposal_portal_token(uuid,boolean) from public, anon, authenticated;
grant execute on function public.ensure_proposal_portal_token(uuid,boolean) to authenticated, service_role;

alter function public.get_invitation_preview(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.get_invitation_preview(text) from public, anon, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated, service_role;

alter function public.portal_accept_proposal(text,text,text,uuid,text,text,text,boolean,text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_accept_proposal(text,text,text,uuid,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.portal_accept_proposal(text,text,text,uuid,text,text,text,boolean,text) to anon, authenticated, service_role;

alter function public.portal_get_client_file(text,text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_get_client_file(text,text) from public, anon, authenticated;
grant execute on function public.portal_get_client_file(text,text) to anon, authenticated, service_role;

alter function public.portal_get_invoice(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_get_invoice(text) from public, anon, authenticated;
grant execute on function public.portal_get_invoice(text) to anon, authenticated, service_role;

alter function public.portal_get_proposal(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_get_proposal(text) from public, anon, authenticated;
grant execute on function public.portal_get_proposal(text) to anon, authenticated, service_role;

alter function public.portal_mark_invoice_viewed(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_mark_invoice_viewed(text) from public, anon, authenticated;
grant execute on function public.portal_mark_invoice_viewed(text) to anon, authenticated, service_role;

alter function public.portal_mark_proposal_viewed(text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_mark_proposal_viewed(text) from public, anon, authenticated;
grant execute on function public.portal_mark_proposal_viewed(text) to anon, authenticated, service_role;

alter function public.portal_verify_client_file_pin(text,text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.portal_verify_client_file_pin(text,text) from public, anon, authenticated;
grant execute on function public.portal_verify_client_file_pin(text,text) to anon, authenticated, service_role;

alter function public.project_profit_snapshot(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.project_profit_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.project_profit_snapshot(uuid) to authenticated, service_role;

alter function public.revoke_client_file_share(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.revoke_client_file_share(uuid) from public, anon, authenticated;
grant execute on function public.revoke_client_file_share(uuid) to authenticated, service_role;

alter function public.revoke_invoice_portal_token(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.revoke_invoice_portal_token(uuid) from public, anon, authenticated;
grant execute on function public.revoke_invoice_portal_token(uuid) to authenticated, service_role;

alter function public.revoke_proposal_portal_token(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.revoke_proposal_portal_token(uuid) from public, anon, authenticated;
grant execute on function public.revoke_proposal_portal_token(uuid) to authenticated, service_role;

alter function public.rotate_client_file_share_pin(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.rotate_client_file_share_pin(uuid) from public, anon, authenticated;
grant execute on function public.rotate_client_file_share_pin(uuid) to authenticated, service_role;

alter function public.send_proposal(uuid)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.send_proposal(uuid) from public, anon, authenticated;
grant execute on function public.send_proposal(uuid) to authenticated, service_role;
