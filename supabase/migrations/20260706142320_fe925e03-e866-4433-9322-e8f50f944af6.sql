
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partial','paid','overdue','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','check','ach','credit_card','stripe','quickbooks','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('pending','invoiced','paid','waived','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.progress_billing_status AS ENUM ('draft','pending_approval','approved','invoiced','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INVOICE LINE ITEMS ============
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage invoice items" ON public.invoice_line_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_invoice_items_invoice ON public.invoice_line_items(invoice_id);

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method public.payment_method NOT NULL DEFAULT 'check',
  reference_number TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  is_void BOOLEAN NOT NULL DEFAULT false,
  voided_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DEPOSITS ============
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  due_date DATE,
  status public.deposit_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage deposits" ON public.deposits FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_deposits_project ON public.deposits(project_id);
CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROGRESS BILLINGS ============
CREATE TABLE public.progress_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  billing_number INT NOT NULL DEFAULT 1,
  percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  retainage NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.progress_billing_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_billings TO authenticated;
GRANT ALL ON public.progress_billings TO service_role;
ALTER TABLE public.progress_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage progress billings" ON public.progress_billings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_progress_billings_project ON public.progress_billings(project_id);
CREATE TRIGGER trg_progress_billings_updated_at BEFORE UPDATE ON public.progress_billings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUTO-RECALC INVOICE BALANCE FROM PAYMENTS ============
CREATE OR REPLACE FUNCTION public.recalc_invoice_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id UUID;
  paid NUMERIC(12,2);
  total_amt NUMERIC(12,2);
  new_bal NUMERIC(12,2);
  new_status public.invoice_status;
  cur_status public.invoice_status;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.payments
    WHERE invoice_id = inv_id AND is_void = false;
  SELECT total, status INTO total_amt, cur_status FROM public.invoices WHERE id = inv_id;
  IF total_amt IS NULL THEN RETURN NEW; END IF;
  new_bal := GREATEST(total_amt - paid, 0);
  IF cur_status = 'void' THEN
    new_status := 'void';
  ELSIF new_bal <= 0 AND total_amt > 0 THEN
    new_status := 'paid';
  ELSIF paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := CASE WHEN cur_status IN ('draft') THEN 'draft' ELSE 'sent' END;
  END IF;
  UPDATE public.invoices SET balance_due = new_bal, status = new_status, updated_at = now()
    WHERE id = inv_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_balance();

-- ============ AUTO-INITIALIZE INVOICE BALANCE ON INSERT/UPDATE OF TOTAL ============
CREATE OR REPLACE FUNCTION public.sync_invoice_balance_from_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE paid NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.payments
    WHERE invoice_id = NEW.id AND is_void = false;
  NEW.balance_due := GREATEST(COALESCE(NEW.total,0) - paid, 0);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoices_sync_balance BEFORE INSERT OR UPDATE OF total ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_balance_from_total();

-- ============ PROFIT SNAPSHOT FUNCTION ============
CREATE OR REPLACE FUNCTION public.project_profit_snapshot(_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  est_rev NUMERIC(12,2) := 0;
  approved_rev NUMERIC(12,2) := 0;
  invoiced_rev NUMERIC(12,2) := 0;
  paid_rev NUMERIC(12,2) := 0;
  est_cost NUMERIC(12,2) := 0;
  act_cost NUMERIC(12,2) := 0;
  gross_profit NUMERIC(12,2);
  net_profit NUMERIC(12,2);
  margin NUMERIC(6,2);
  variance NUMERIC(12,2);
BEGIN
  SELECT COALESCE(MAX(grand_total),0) INTO est_rev FROM public.estimates WHERE project_id = _project_id;
  SELECT COALESCE(SUM(price),0) INTO approved_rev FROM public.proposal_options po
    JOIN public.proposals p ON p.id = po.proposal_id
    WHERE p.project_id = _project_id AND p.status IN ('accepted','signed','approved') AND po.is_selected = true;
  IF approved_rev = 0 THEN
    SELECT COALESCE(MAX(grand_total),0) INTO approved_rev FROM public.estimates WHERE project_id = _project_id;
  END IF;
  SELECT COALESCE(SUM(total),0) INTO invoiced_rev FROM public.invoices
    WHERE project_id = _project_id AND status <> 'void';
  SELECT COALESCE(SUM(p.amount),0) INTO paid_rev FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE i.project_id = _project_id AND p.is_void = false AND i.status <> 'void';
  SELECT COALESCE(SUM(estimated),0), COALESCE(SUM(actual),0)
    INTO est_cost, act_cost FROM public.job_costs WHERE project_id = _project_id;

  gross_profit := approved_rev - act_cost;
  net_profit := paid_rev - act_cost;
  margin := CASE WHEN approved_rev > 0 THEN ROUND((approved_rev - act_cost) / approved_rev * 100, 2) ELSE 0 END;
  variance := (approved_rev - est_rev) - (act_cost - est_cost);

  RETURN jsonb_build_object(
    'estimated_revenue', est_rev,
    'approved_revenue', approved_rev,
    'invoiced_revenue', invoiced_rev,
    'paid_revenue', paid_rev,
    'outstanding_balance', invoiced_rev - paid_rev,
    'estimated_cost', est_cost,
    'actual_cost', act_cost,
    'gross_profit', gross_profit,
    'net_profit', net_profit,
    'profit_margin_pct', margin,
    'variance', variance
  );
END $$;

GRANT EXECUTE ON FUNCTION public.project_profit_snapshot(UUID) TO authenticated;
