
-- 1. Add estimate_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_estimate ON public.invoices(estimate_id);

-- 2. Add traceability columns to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status public.invoice_status,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- 3. Add traceability columns to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status public.invoice_status,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- 4. Sync trigger: keep proposals/estimates pointing at their latest invoice + current status
CREATE OR REPLACE FUNCTION public.sync_invoice_backrefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_proposal UUID;
  target_estimate UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Recompute from remaining invoices
    IF OLD.proposal_id IS NOT NULL THEN
      UPDATE public.proposals p SET
        invoice_id = latest.id,
        invoice_number = latest.invoice_number,
        invoice_status = latest.status,
        invoiced_at = latest.created_at,
        updated_at = now()
      FROM (
        SELECT id, invoice_number, status, created_at
        FROM public.invoices
        WHERE proposal_id = OLD.proposal_id
        ORDER BY created_at DESC LIMIT 1
      ) latest
      WHERE p.id = OLD.proposal_id;
      UPDATE public.proposals SET invoice_id = NULL, invoice_number = NULL,
        invoice_status = NULL, invoiced_at = NULL, updated_at = now()
      WHERE id = OLD.proposal_id
        AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE proposal_id = OLD.proposal_id);
    END IF;
    IF OLD.estimate_id IS NOT NULL THEN
      UPDATE public.estimates e SET
        invoice_id = latest.id,
        invoice_number = latest.invoice_number,
        invoice_status = latest.status,
        invoiced_at = latest.created_at,
        updated_at = now()
      FROM (
        SELECT id, invoice_number, status, created_at
        FROM public.invoices
        WHERE estimate_id = OLD.estimate_id
        ORDER BY created_at DESC LIMIT 1
      ) latest
      WHERE e.id = OLD.estimate_id;
      UPDATE public.estimates SET invoice_id = NULL, invoice_number = NULL,
        invoice_status = NULL, invoiced_at = NULL, updated_at = now()
      WHERE id = OLD.estimate_id
        AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE estimate_id = OLD.estimate_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: point back-refs at this invoice
  IF NEW.proposal_id IS NOT NULL THEN
    UPDATE public.proposals SET
      invoice_id = NEW.id,
      invoice_number = NEW.invoice_number,
      invoice_status = NEW.status,
      invoiced_at = COALESCE(invoiced_at, NEW.created_at, now()),
      updated_at = now()
    WHERE id = NEW.proposal_id;
  END IF;
  IF NEW.estimate_id IS NOT NULL THEN
    UPDATE public.estimates SET
      invoice_id = NEW.id,
      invoice_number = NEW.invoice_number,
      invoice_status = NEW.status,
      invoiced_at = COALESCE(invoiced_at, NEW.created_at, now()),
      updated_at = now()
    WHERE id = NEW.estimate_id;
  END IF;

  -- If proposal_id/estimate_id was cleared on UPDATE, blank the previous side
  IF TG_OP = 'UPDATE' THEN
    IF OLD.proposal_id IS DISTINCT FROM NEW.proposal_id AND OLD.proposal_id IS NOT NULL THEN
      UPDATE public.proposals SET invoice_id = NULL, invoice_number = NULL,
        invoice_status = NULL, invoiced_at = NULL, updated_at = now()
      WHERE id = OLD.proposal_id AND invoice_id = OLD.id;
    END IF;
    IF OLD.estimate_id IS DISTINCT FROM NEW.estimate_id AND OLD.estimate_id IS NOT NULL THEN
      UPDATE public.estimates SET invoice_id = NULL, invoice_number = NULL,
        invoice_status = NULL, invoiced_at = NULL, updated_at = now()
      WHERE id = OLD.estimate_id AND invoice_id = OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_sync_backrefs ON public.invoices;
CREATE TRIGGER trg_invoices_sync_backrefs
AFTER INSERT OR UPDATE OF status, invoice_number, proposal_id, estimate_id OR DELETE
ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_backrefs();

-- 5. Backfill existing links from current invoice rows
UPDATE public.proposals p SET
  invoice_id = i.id,
  invoice_number = i.invoice_number,
  invoice_status = i.status,
  invoiced_at = i.created_at
FROM (
  SELECT DISTINCT ON (proposal_id) id, proposal_id, invoice_number, status, created_at
  FROM public.invoices
  WHERE proposal_id IS NOT NULL
  ORDER BY proposal_id, created_at DESC
) i
WHERE p.id = i.proposal_id;
