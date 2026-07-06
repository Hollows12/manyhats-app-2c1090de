
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
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
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
