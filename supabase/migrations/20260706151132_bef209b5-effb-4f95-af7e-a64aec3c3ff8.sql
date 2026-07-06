
-- 1. Columns on proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_proposals_portal_token ON public.proposals(portal_token);

-- 2. Public read RPC — accessible without login via token
CREATE OR REPLACE FUNCTION public.portal_get_proposal(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  opts JSONB;
  invs JSONB;
  proj RECORD;
  client_name TEXT;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT p.* INTO prop FROM public.proposals p WHERE p.portal_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF prop.portal_token_expires_at IS NOT NULL AND prop.portal_token_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT pj.id, pj.name, pj.job_address, pj.city, pj.state, pj.zip, pj.client_id
    INTO proj FROM public.projects pj WHERE pj.id = prop.project_id;

  SELECT c.name INTO client_name FROM public.clients c WHERE c.id = proj.client_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', po.id, 'tier', po.tier, 'title', po.title,
    'description', po.description, 'price', po.price,
    'is_recommended', po.is_recommended, 'sort_order', po.sort_order
  ) ORDER BY po.sort_order), '[]'::jsonb)
    INTO opts FROM public.proposal_options po WHERE po.proposal_id = prop.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'invoice_number', i.invoice_number,
    'invoice_date', i.invoice_date, 'due_date', i.due_date,
    'subtotal', i.subtotal, 'tax', i.tax, 'total', i.total,
    'balance_due', i.balance_due, 'status', i.status
  ) ORDER BY i.invoice_date DESC), '[]'::jsonb)
    INTO invs FROM public.invoices i
    WHERE i.project_id = proj.id AND i.status <> 'void';

  RETURN jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', prop.id,
      'proposal_number', prop.proposal_number,
      'status', prop.status,
      'executive_summary', prop.executive_summary,
      'scope_of_work', prop.scope_of_work,
      'recommendation', prop.recommendation,
      'timeline', prop.timeline,
      'warranty_length', prop.warranty_length,
      'warranty_notes', prop.warranty_notes,
      'exclusions', prop.exclusions,
      'payment_terms', prop.payment_terms,
      'sent_at', prop.sent_at,
      'approved_at', prop.approved_at
    ),
    'options', opts,
    'project', jsonb_build_object(
      'name', proj.name,
      'address', proj.job_address,
      'city_state_zip', concat_ws(', ', proj.city, concat_ws(' ', proj.state, proj.zip))
    ),
    'client_name', client_name,
    'invoices', invs,
    'totals', jsonb_build_object(
      'invoiced', COALESCE((SELECT SUM(total) FROM public.invoices WHERE project_id = proj.id AND status <> 'void'), 0),
      'outstanding', COALESCE((SELECT SUM(balance_due) FROM public.invoices WHERE project_id = proj.id AND status <> 'void'), 0)
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.portal_get_proposal(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_get_proposal(TEXT) TO anon, authenticated;

-- 3. Public accept RPC
CREATE OR REPLACE FUNCTION public.portal_accept_proposal(
  _token TEXT,
  _signer_name TEXT,
  _signer_email TEXT,
  _selected_option_id UUID,
  _signature_data TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  sig_id UUID;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF _signer_name IS NULL OR length(trim(_signer_name)) < 2 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  SELECT * INTO prop FROM public.proposals WHERE portal_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF prop.portal_token_expires_at IS NOT NULL AND prop.portal_token_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;
  IF prop.status = 'approved' THEN
    RETURN jsonb_build_object('error', 'already_accepted');
  END IF;

  IF _selected_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proposal_options WHERE id = _selected_option_id AND proposal_id = prop.id
  ) THEN
    RETURN jsonb_build_object('error', 'invalid_option');
  END IF;

  INSERT INTO public.proposal_signatures
    (proposal_id, signer_name, signer_email, signature_data, selected_option_id, ip_address)
    VALUES (prop.id, trim(_signer_name), NULLIF(trim(_signer_email), ''), _signature_data, _selected_option_id, _ip_address)
    RETURNING id INTO sig_id;

  UPDATE public.proposals
    SET status = 'approved', approved_at = now(), updated_at = now()
    WHERE id = prop.id;

  RETURN jsonb_build_object('ok', true, 'signature_id', sig_id, 'proposal_id', prop.id);
END $$;

REVOKE ALL ON FUNCTION public.portal_accept_proposal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_accept_proposal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- 4. Staff-only helper to mint/rotate portal token
CREATE OR REPLACE FUNCTION public.ensure_proposal_portal_token(_proposal_id UUID, _rotate BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok TEXT;
  exp TIMESTAMPTZ;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT portal_token, portal_token_expires_at INTO tok, exp
    FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF tok IS NULL OR _rotate OR (exp IS NOT NULL AND exp < now()) THEN
    tok := encode(gen_random_bytes(24), 'hex');
    exp := now() + interval '90 days';
    UPDATE public.proposals
      SET portal_token = tok, portal_token_expires_at = exp, updated_at = now()
      WHERE id = _proposal_id;
  END IF;

  RETURN jsonb_build_object('token', tok, 'expires_at', exp);
END $$;

REVOKE ALL ON FUNCTION public.ensure_proposal_portal_token(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_proposal_portal_token(UUID, BOOLEAN) TO authenticated;
