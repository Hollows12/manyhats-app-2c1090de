-- Harden intentionally exposed SECURITY DEFINER functions with a fixed,
-- minimal search path that includes Supabase's pgcrypto extension schema.

alter function public.accept_invitation(text)
  set search_path = pg_catalog, public, extensions;

alter function public.create_client_file_share(uuid,text,integer,boolean)
  set search_path = pg_catalog, public, extensions;

alter function public.ensure_invoice_portal_token(uuid,boolean)
  set search_path = pg_catalog, public, extensions;

alter function public.ensure_proposal_portal_token(uuid,boolean)
  set search_path = pg_catalog, public, extensions;

alter function public.get_invitation_preview(text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_accept_proposal(text,text,text,uuid,text,text,text,boolean,text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_get_client_file(text,text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_get_invoice(text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_get_proposal(text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_mark_invoice_viewed(text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_mark_proposal_viewed(text)
  set search_path = pg_catalog, public, extensions;

alter function public.portal_verify_client_file_pin(text,text)
  set search_path = pg_catalog, public, extensions;

alter function public.project_profit_snapshot(uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.revoke_client_file_share(uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.revoke_invoice_portal_token(uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.revoke_proposal_portal_token(uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.rotate_client_file_share_pin(uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.send_proposal(uuid)
  set search_path = pg_catalog, public, extensions;
