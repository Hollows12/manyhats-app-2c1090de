-- Migration: harden_function_execute_privileges
-- Drops the obsolete six-argument portal_accept_proposal overload,
-- revokes anonymous/public execution from internal and staff RPCs,
-- preserves intentional portal (token-scoped) API access,
-- and sets a restrictive default for future public-schema functions.

-- ---------------------------------------------------------------------------
-- 1. Drop the obsolete six-argument overload of portal_accept_proposal
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.portal_accept_proposal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- 2. Revoke anonymous execution from staff/application RPCs
--    These require an authenticated session; anon must never call them.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.accept_invitation FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_invoice_portal_token FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_portal_token FROM anon;
REVOKE EXECUTE ON FUNCTION public.project_profit_snapshot FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invoice_portal_token FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_proposal_portal_token FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_proposal FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Revoke PUBLIC/anon/authenticated execution from internal trigger helpers
--    These are only ever invoked by the database trigger infrastructure.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.notify_staff FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_payment_insert FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_signature_insert FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_balance FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_backrefs FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_balance_from_total FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Explicitly preserve anon/authenticated access to intentional
--    token-scoped portal APIs
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_invitation_preview TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_client_file TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_invoice TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_proposal TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_invoice_viewed TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_proposal_viewed TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_verify_client_file_pin TO anon, authenticated;

-- portal_accept_proposal (nine arguments) — preserve portal access
DO $$
DECLARE
  _sig TEXT;
BEGIN
  SELECT pg_get_function_identity_arguments(p.oid)
    INTO _sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'portal_accept_proposal'
   ORDER BY p.pronargs DESC
   LIMIT 1;

  IF _sig IS NOT NULL THEN
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.portal_accept_proposal(%s) TO anon, authenticated',
      _sig
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Revoke default EXECUTE privileges for future public-schema functions
--    from PUBLIC, anon, and authenticated.
--    Future RPCs must explicitly GRANT access to opt in.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
