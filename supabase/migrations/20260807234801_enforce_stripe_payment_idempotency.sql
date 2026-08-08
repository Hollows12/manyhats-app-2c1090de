-- Enforce Stripe payment replay safety and harden trigger function search_path.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_intent_unique_idx
  ON public.payments(reference_number)
  WHERE payment_method = 'stripe' AND reference_number IS NOT NULL;

ALTER FUNCTION public.set_updated_at() SET search_path = '';
