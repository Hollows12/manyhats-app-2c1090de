-- Migration: close_public_rpc_execute_inheritance
-- REVOKE from anon alone is insufficient when PUBLIC retains EXECUTE,
-- because anon inherits privileges granted to PUBLIC. Remove both grants,
-- then explicitly preserve authenticated application access.

REVOKE EXECUTE ON FUNCTION public.accept_invitation FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_invoice_portal_token FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_portal_token FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_profit_snapshot FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invoice_portal_token FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_proposal_portal_token FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_proposal FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_invoice_portal_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_proposal_portal_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_profit_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invoice_portal_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_proposal_portal_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_proposal TO authenticated;