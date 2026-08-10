-- Migration: enforce_stripe_payment_idempotency
-- Adds a partial unique index on payments(reference_number) for non-null
-- Stripe references, preventing duplicate webhook processing.
-- Also hardens public.set_updated_at() with an empty search_path.

-- Partial unique index: only non-null reference_number values must be unique.
-- This covers Stripe payment intent IDs (pi_...) without constraining
-- manual payments that may have no reference number.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_intent_unique_idx
  ON public.payments (reference_number)
  WHERE reference_number IS NOT NULL;

-- Harden the set_updated_at trigger function with an empty search_path
-- to prevent schema-spoofing attacks.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
