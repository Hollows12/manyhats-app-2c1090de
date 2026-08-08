-- Tighten EXECUTE privileges for RPC boundaries.

-- Remove obsolete portal_accept_proposal signature.
DROP FUNCTION IF EXISTS public.portal_accept_proposal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

-- Remove broad execute grants on public functions.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Remove anonymous execution from all functions; selectively re-grant token-scoped portal RPCs.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Internal helper/trigger functions are not callable by app roles.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;

-- Staff/internal RPCs must never be callable anonymously.
REVOKE EXECUTE ON FUNCTION public.accept_invitation(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_client_file_share(UUID, TEXT, INT, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rotate_client_file_share_pin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_client_file_share(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_portal_token(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_invoice_portal_token(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_proposal_portal_token(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invoice_portal_token(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_proposal(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.project_profit_snapshot(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_schema_snapshot() FROM anon;

-- Public token-scoped portal/invitation RPCs.
GRANT EXECUTE ON FUNCTION public.portal_get_proposal(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_accept_proposal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_proposal_viewed(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_invoice(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_invoice_viewed(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_client_file(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_verify_client_file_pin(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO anon, authenticated;

-- Explicitly preserve authenticated/service-role application paths.
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_file_share(UUID, TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_client_file_share_pin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_client_file_share(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_proposal_portal_token(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_invoice_portal_token(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_proposal_portal_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invoice_portal_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_profit_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_schema_snapshot() TO service_role;

-- Future functions in public schema are opt-in only.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
