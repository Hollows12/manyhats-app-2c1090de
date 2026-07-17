-- Add recalculate_invoice_balance as a callable RPC so the Stripe webhook
-- can trigger a recalculation without relying solely on the payments trigger.
-- Idempotent: uses CREATE OR REPLACE. Safe to apply multiple times.

CREATE OR REPLACE FUNCTION public.recalculate_invoice_balance(_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    new_status := CASE WHEN cur_status = 'draft' THEN 'draft' ELSE 'sent' END;
  END IF;

  UPDATE public.invoices
     SET balance_due = new_bal,
         status      = new_status,
         updated_at  = now()
   WHERE id = _invoice_id;
END;
$$;

-- Grant to authenticated staff and service_role (webhook uses service_role)
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_balance(UUID) TO authenticated, service_role;
