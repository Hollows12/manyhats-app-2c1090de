-- Add recalculate_invoice_balance as a callable RPC so the Stripe webhook
-- can trigger a recalculation without relying solely on the payments trigger.
-- Idempotent: uses CREATE OR REPLACE. Safe to apply multiple times.
--
-- SECURITY HARDENING (2026-08-06):
-- - Changed from SECURITY DEFINER to SECURITY INVOKER
--   (caller must have the privileges to modify invoices/payments)
-- - Set search_path = '' to prevent schema spoofing attacks
-- - Fully qualified all database objects with public. prefix
-- - Revoked access from PUBLIC, anon, and authenticated
-- - Granted access only to service_role (Stripe webhook's elevated client)
--
-- The Stripe webhook handler (src/routes/api/stripe.webhook.tsx) uses:
--   const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY)
-- This ensures the RPC is called with service_role privileges only.

CREATE OR REPLACE FUNCTION public.recalculate_invoice_balance(_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  paid      NUMERIC(12,2);
  total_amt NUMERIC(12,2);
  new_bal   NUMERIC(12,2);
  new_status public.invoice_status;
  cur_status public.invoice_status;
BEGIN
  -- Fetch the invoice totals and current status (scoped to the invoice)
  SELECT total, status
    INTO total_amt, cur_status
    FROM public.invoices
   WHERE id = _invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', _invoice_id;
  END IF;

  -- Sum non-voided payments
  SELECT COALESCE(SUM(amount), 0)
    INTO paid
    FROM public.payments
   WHERE invoice_id = _invoice_id
     AND is_void = false;

  new_bal := GREATEST(total_amt - paid, 0);

  -- Determine the new status, preserving void
  IF cur_status = 'void' THEN
    new_status := 'void';
  ELSIF new_bal <= 0 AND total_amt > 0 THEN
    new_status := 'paid';
  ELSIF paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := CASE
      WHEN cur_status = 'draft' THEN 'draft'
      WHEN cur_status = 'overdue' THEN 'overdue'
      ELSE 'sent'
    END;
  END IF;

  UPDATE public.invoices
     SET balance_due = new_bal,
         status      = new_status,
         updated_at  = now()
   WHERE id = _invoice_id;
END;
$$;

-- Privilege grants: INVOKER mode requires caller to have necessary privileges.
-- Only service_role (Stripe webhook's elevated client) is granted access.
-- All other roles revoked to prevent unauthorized invocations.
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) TO service_role;
