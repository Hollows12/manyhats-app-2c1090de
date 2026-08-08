-- Privilege matrix verification for migration 20260807234802_harden_function_execute_privileges
--
-- Run this against a fresh database after applying all migrations to verify the
-- complete privilege matrix. Each assertion uses a subquery against
-- information_schema.role_routine_grants to confirm the expected grant state.
--
-- Usage:
--   supabase start
--   psql "$DATABASE_URL" -f supabase/tests/privilege_matrix.sql
--
-- All DO blocks raise an exception on failure and print a success message on pass.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Internal trigger/accounting functions: anon=false AND authenticated=false
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_func TEXT;
  v_role TEXT;
  v_granted BOOLEAN;
BEGIN
  FOR v_func, v_role IN VALUES
    ('notify_staff',                   'anon'),
    ('notify_staff',                   'authenticated'),
    ('on_payment_insert',              'anon'),
    ('on_payment_insert',              'authenticated'),
    ('on_proposal_signature_insert',   'anon'),
    ('on_proposal_signature_insert',   'authenticated'),
    ('recalc_invoice_balance',         'anon'),
    ('recalc_invoice_balance',         'authenticated'),
    ('sync_invoice_backrefs',          'anon'),
    ('sync_invoice_backrefs',          'authenticated'),
    ('sync_invoice_balance_from_total','anon'),
    ('sync_invoice_balance_from_total','authenticated')
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name   = v_func
        AND grantee        = v_role
        AND privilege_type = 'EXECUTE'
    ) INTO v_granted;

    IF v_granted THEN
      RAISE EXCEPTION
        'FAIL: % has EXECUTE on public.% — expected no grant',
        v_role, v_func;
    ELSE
      RAISE NOTICE 'PASS: % correctly has NO EXECUTE on public.%', v_role, v_func;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Portal token-scoped RPCs: anon=true
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_func TEXT;
  v_granted BOOLEAN;
BEGIN
  FOR v_func IN VALUES
    ('portal_get_proposal'),
    ('portal_accept_proposal'),
    ('portal_mark_proposal_viewed'),
    ('portal_get_invoice'),
    ('portal_mark_invoice_viewed'),
    ('portal_get_client_file'),
    ('portal_verify_client_file_pin'),
    ('get_invitation_preview')
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name   = v_func
        AND grantee        = 'anon'
        AND privilege_type = 'EXECUTE'
    ) INTO v_granted;

    IF NOT v_granted THEN
      RAISE EXCEPTION
        'FAIL: anon is missing EXECUTE on public.% — expected grant',
        v_func;
    ELSE
      RAISE NOTICE 'PASS: anon correctly has EXECUTE on public.%', v_func;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Staff/internal RPCs: anon=false
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_func TEXT;
  v_granted BOOLEAN;
BEGIN
  FOR v_func IN VALUES
    ('accept_invitation'),
    ('create_client_file_share'),
    ('rotate_client_file_share_pin'),
    ('revoke_client_file_share'),
    ('ensure_proposal_portal_token'),
    ('ensure_invoice_portal_token'),
    ('revoke_proposal_portal_token'),
    ('revoke_invoice_portal_token'),
    ('send_proposal'),
    ('project_profit_snapshot'),
    ('recalculate_invoice_balance'),
    ('get_public_schema_snapshot')
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name   = v_func
        AND grantee        = 'anon'
        AND privilege_type = 'EXECUTE'
    ) INTO v_granted;

    IF v_granted THEN
      RAISE EXCEPTION
        'FAIL: anon has EXECUTE on public.% — expected no grant',
        v_func;
    ELSE
      RAISE NOTICE 'PASS: anon correctly has NO EXECUTE on public.%', v_func;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Obsolete 6-argument portal_accept_proposal overload is absent
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'portal_accept_proposal'
      AND pronargs  = 6
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION
      'FAIL: obsolete 6-argument portal_accept_proposal overload still exists';
  ELSE
    RAISE NOTICE 'PASS: 6-argument portal_accept_proposal overload is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Summary
-- ─────────────────────────────────────────────────────────────────────────────
-- If this script completes without raising an exception the privilege matrix is
-- correct:
--   • anon=false, authenticated=false  for all six internal functions
--   • anon=true                        for all intended portal RPCs
--   • anon=false                       for all staff/internal RPCs
--   • 6-arg portal_accept_proposal     ABSENT
