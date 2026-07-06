
-- Phase 2: Customer portal expansion — invoice portal, send tracking, notifications

-- 1) Invoice portal + send/viewed tracking
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_portal_token ON public.invoices(portal_token);

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Extra signature fields
ALTER TABLE public.proposal_signatures
  ADD COLUMN IF NOT EXISTS signer_phone TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_kind TEXT NOT NULL DEFAULT 'typed';

-- 2) In-app notifications (staff-scoped, broadcast if user_id IS NULL)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_staff_read" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "notif_staff_update" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "notif_staff_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(is_read) WHERE is_read = false;

-- 3) Helper: push a broadcast notification (user_id NULL = all staff)
CREATE OR REPLACE FUNCTION public.notify_staff(_kind TEXT, _message TEXT, _project_id UUID, _entity_type TEXT, _entity_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, message, project_id, entity_type, entity_id)
  VALUES (NULL, _kind, _message, _project_id, _entity_type, _entity_id);
END $$;

-- 4) Trigger: notify on proposal signature
CREATE OR REPLACE FUNCTION public.on_proposal_signature_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj_id UUID;
  prop_num TEXT;
BEGIN
  SELECT p.project_id, p.proposal_number INTO proj_id, prop_num
    FROM public.proposals p WHERE p.id = NEW.proposal_id;
  PERFORM public.notify_staff(
    'proposal_signed',
    'Proposal ' || COALESCE(prop_num,'') || ' signed by ' || NEW.signer_name,
    proj_id, 'proposal', NEW.proposal_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_proposal_sig ON public.proposal_signatures;
CREATE TRIGGER trg_notify_proposal_sig
  AFTER INSERT ON public.proposal_signatures
  FOR EACH ROW EXECUTE FUNCTION public.on_proposal_signature_insert();

-- 5) Trigger: notify on payment insert
CREATE OR REPLACE FUNCTION public.on_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj_id UUID;
  inv_num TEXT;
BEGIN
  IF NEW.is_void THEN RETURN NEW; END IF;
  SELECT i.project_id, i.invoice_number INTO proj_id, inv_num
    FROM public.invoices i WHERE i.id = NEW.invoice_id;
  PERFORM public.notify_staff(
    'payment_received',
    'Payment $' || NEW.amount::text || ' received on invoice ' || COALESCE(inv_num,''),
    proj_id, 'payment', NEW.id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_payment ON public.payments;
CREATE TRIGGER trg_notify_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_insert();

-- 6) Staff RPCs: send proposal, ensure invoice token, revoke
CREATE OR REPLACE FUNCTION public.send_proposal(_proposal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok TEXT;
  exp TIMESTAMPTZ;
  prop RECORD;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  SELECT id, portal_token, portal_token_expires_at, project_id, proposal_number, status
    INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  tok := prop.portal_token;
  exp := prop.portal_token_expires_at;
  IF tok IS NULL OR (exp IS NOT NULL AND exp < now()) THEN
    tok := encode(gen_random_bytes(24), 'hex');
    exp := now() + interval '90 days';
  END IF;

  UPDATE public.proposals
    SET status = CASE WHEN status IN ('draft') THEN 'sent'::proposal_status ELSE status END,
        sent_at = COALESCE(sent_at, now()),
        portal_token = tok,
        portal_token_expires_at = exp,
        updated_at = now()
    WHERE id = _proposal_id;

  PERFORM public.notify_staff('proposal_sent',
    'Proposal ' || prop.proposal_number || ' marked as sent',
    prop.project_id, 'proposal', _proposal_id);

  RETURN jsonb_build_object('ok', true, 'token', tok, 'expires_at', exp);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_proposal_portal_token(_proposal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  UPDATE public.proposals
    SET portal_token = NULL, portal_token_expires_at = NULL, updated_at = now()
    WHERE id = _proposal_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.ensure_invoice_portal_token(_invoice_id UUID, _rotate BOOLEAN DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok TEXT;
  exp TIMESTAMPTZ;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  SELECT portal_token, portal_token_expires_at INTO tok, exp
    FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF tok IS NULL OR _rotate OR (exp IS NOT NULL AND exp < now()) THEN
    tok := encode(gen_random_bytes(24), 'hex');
    exp := now() + interval '90 days';
    UPDATE public.invoices
      SET portal_token = tok, portal_token_expires_at = exp,
          sent_at = COALESCE(sent_at, now()),
          status = CASE WHEN status = 'draft' THEN 'sent'::invoice_status ELSE status END,
          updated_at = now()
      WHERE id = _invoice_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'token', tok, 'expires_at', exp);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_invoice_portal_token(_invoice_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  UPDATE public.invoices
    SET portal_token = NULL, portal_token_expires_at = NULL, updated_at = now()
    WHERE id = _invoice_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 7) Public portal RPCs
CREATE OR REPLACE FUNCTION public.portal_mark_proposal_viewed(_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  SELECT id, project_id, proposal_number, viewed_at INTO prop
    FROM public.proposals WHERE portal_token = _token
      AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF prop.viewed_at IS NULL THEN
    UPDATE public.proposals SET viewed_at = now(), updated_at = now() WHERE id = prop.id;
    PERFORM public.notify_staff('proposal_viewed',
      'Proposal ' || prop.proposal_number || ' viewed by client',
      prop.project_id, 'proposal', prop.id);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.portal_mark_invoice_viewed(_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  SELECT id, project_id, invoice_number, viewed_at INTO inv
    FROM public.invoices WHERE portal_token = _token
      AND (portal_token_expires_at IS NULL OR portal_token_expires_at > now());
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF inv.viewed_at IS NULL THEN
    UPDATE public.invoices SET viewed_at = now(), updated_at = now() WHERE id = inv.id;
    PERFORM public.notify_staff('invoice_viewed',
      'Invoice ' || inv.invoice_number || ' viewed by client',
      inv.project_id, 'invoice', inv.id);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.portal_get_invoice(_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  proj RECORD;
  client_name TEXT;
  items JSONB;
  pays JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  SELECT * INTO inv FROM public.invoices WHERE portal_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF inv.portal_token_expires_at IS NOT NULL AND inv.portal_token_expires_at < now() THEN
    RETURN jsonb_build_object('error','expired');
  END IF;

  SELECT pj.id, pj.name, pj.job_address, pj.city, pj.state, pj.zip, pj.client_id
    INTO proj FROM public.projects pj WHERE pj.id = inv.project_id;
  SELECT c.name INTO client_name FROM public.clients c WHERE c.id = proj.client_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', li.id, 'description', li.description, 'quantity', li.quantity,
    'unit', li.unit, 'unit_price', li.unit_price, 'line_total', li.line_total,
    'sort_order', li.sort_order
  ) ORDER BY li.sort_order), '[]'::jsonb)
    INTO items FROM public.invoice_line_items li WHERE li.invoice_id = inv.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'amount', p.amount, 'payment_date', p.payment_date,
    'method', p.method, 'reference', p.reference
  ) ORDER BY p.payment_date DESC), '[]'::jsonb)
    INTO pays FROM public.payments p
    WHERE p.invoice_id = inv.id AND p.is_void = false;

  RETURN jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', inv.id, 'invoice_number', inv.invoice_number,
      'invoice_date', inv.invoice_date, 'due_date', inv.due_date,
      'subtotal', inv.subtotal, 'tax', inv.tax, 'total', inv.total,
      'balance_due', inv.balance_due, 'status', inv.status,
      'notes', inv.notes, 'sent_at', inv.sent_at, 'viewed_at', inv.viewed_at
    ),
    'line_items', items,
    'payments', pays,
    'project', jsonb_build_object(
      'name', proj.name,
      'address', proj.job_address,
      'city_state_zip', concat_ws(', ', proj.city, concat_ws(' ', proj.state, proj.zip))
    ),
    'client_name', client_name
  );
END $$;

-- 8) Extend portal_accept_proposal to accept phone + terms
CREATE OR REPLACE FUNCTION public.portal_accept_proposal(
  _token TEXT,
  _signer_name TEXT,
  _signer_email TEXT,
  _selected_option_id UUID,
  _signature_data TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL,
  _signer_phone TEXT DEFAULT NULL,
  _terms_accepted BOOLEAN DEFAULT false,
  _signature_kind TEXT DEFAULT 'typed'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  sig_id UUID;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  IF _signer_name IS NULL OR length(trim(_signer_name)) < 2 THEN
    RETURN jsonb_build_object('error','name_required');
  END IF;
  IF NOT COALESCE(_terms_accepted, false) THEN
    RETURN jsonb_build_object('error','terms_required');
  END IF;

  SELECT * INTO prop FROM public.proposals WHERE portal_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF prop.portal_token_expires_at IS NOT NULL AND prop.portal_token_expires_at < now() THEN
    RETURN jsonb_build_object('error','expired');
  END IF;
  IF prop.status = 'approved' THEN
    RETURN jsonb_build_object('error','already_accepted');
  END IF;

  IF _selected_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proposal_options WHERE id = _selected_option_id AND proposal_id = prop.id
  ) THEN
    RETURN jsonb_build_object('error','invalid_option');
  END IF;

  INSERT INTO public.proposal_signatures
    (proposal_id, signer_name, signer_email, signature_data, selected_option_id,
     ip_address, signer_phone, terms_accepted, signature_kind)
    VALUES (prop.id, trim(_signer_name), NULLIF(trim(_signer_email), ''),
            _signature_data, _selected_option_id, _ip_address,
            NULLIF(trim(_signer_phone), ''), _terms_accepted,
            COALESCE(_signature_kind, 'typed'))
    RETURNING id INTO sig_id;

  UPDATE public.proposals
    SET status = 'approved', approved_at = now(), updated_at = now()
    WHERE id = prop.id;

  RETURN jsonb_build_object('ok', true, 'signature_id', sig_id, 'proposal_id', prop.id);
END $$;
