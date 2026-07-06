
-- pgcrypto for PIN hashing (bcrypt via crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. CLIENT FILE SHARES (token + email PIN portal)
-- =========================================================
CREATE TABLE public.client_file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  recipient_email TEXT,
  pin_hash TEXT NOT NULL,
  pin_verified_at TIMESTAMPTZ,
  pin_attempts INT NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  include_internal_notes BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_file_shares_project ON public.client_file_shares(project_id);
CREATE INDEX idx_client_file_shares_token ON public.client_file_shares(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_file_shares TO authenticated;
GRANT ALL ON public.client_file_shares TO service_role;

ALTER TABLE public.client_file_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage client file shares"
  ON public.client_file_shares FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_client_file_shares_updated
  BEFORE UPDATE ON public.client_file_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. CLIENT FILE SHARE VIEWS (view tracking)
-- =========================================================
CREATE TABLE public.client_file_share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.client_file_shares(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_client_file_share_views_share ON public.client_file_share_views(share_id);

GRANT SELECT ON public.client_file_share_views TO authenticated;
GRANT ALL ON public.client_file_share_views TO service_role;

ALTER TABLE public.client_file_share_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read share views"
  ON public.client_file_share_views FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- =========================================================
-- 3. ACTIVITY LOGS (org-wide activity, admin/staff scoped)
-- =========================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_project ON public.activity_logs(project_id, created_at DESC);
CREATE INDEX idx_activity_logs_actor ON public.activity_logs(actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins see everything; crew see only rows they authored
CREATE POLICY "Admins read all activity"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Crew read own activity"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Staff insert activity"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());

-- =========================================================
-- 4. ERROR LOGS (admin-only read; anyone signed-in can log own error)
-- =========================================================
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  route TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_project ON public.error_logs(project_id, created_at DESC);

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Signed-in users insert own errors"
  ON public.error_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =========================================================
-- 5. AUDIT TRAILS (before/after diffs, admin-only read)
-- =========================================================
CREATE TABLE public.audit_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_trails_entity ON public.audit_trails(entity_type, entity_id);
CREATE INDEX idx_audit_trails_project ON public.audit_trails(project_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_trails TO authenticated;
GRANT ALL ON public.audit_trails TO service_role;

ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit trails"
  ON public.audit_trails FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff insert audit trails"
  ON public.audit_trails FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());

-- =========================================================
-- 6. RPCs — client file share (staff)
-- =========================================================

-- Create a share: returns token + raw PIN (staff must email it, never stored raw)
CREATE OR REPLACE FUNCTION public.create_client_file_share(
  _project_id UUID,
  _recipient_email TEXT,
  _expires_days INT DEFAULT 14,
  _include_internal_notes BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok TEXT;
  pin TEXT;
  new_id UUID;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  IF _expires_days IS NULL OR _expires_days < 1 OR _expires_days > 90 THEN
    _expires_days := 14;
  END IF;
  tok := encode(gen_random_bytes(24), 'hex');
  pin := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  INSERT INTO public.client_file_shares(
    project_id, token, recipient_email, pin_hash,
    expires_at, include_internal_notes, created_by
  ) VALUES (
    _project_id, tok, NULLIF(trim(_recipient_email),''),
    crypt(pin, gen_salt('bf', 10)),
    now() + make_interval(days => _expires_days),
    COALESCE(_include_internal_notes, false),
    auth.uid()
  ) RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', new_id,
    'token', tok,
    'pin', pin,
    'expires_at', (now() + make_interval(days => _expires_days))
  );
END $$;

-- Rotate PIN
CREATE OR REPLACE FUNCTION public.rotate_client_file_share_pin(_share_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pin TEXT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  pin := lpad((floor(random() * 900000) + 100000)::text, 6, '0');
  UPDATE public.client_file_shares
    SET pin_hash = crypt(pin, gen_salt('bf', 10)),
        pin_attempts = 0,
        pin_locked_until = NULL,
        pin_verified_at = NULL,
        updated_at = now()
    WHERE id = _share_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'pin', pin);
END $$;

-- Revoke
CREATE OR REPLACE FUNCTION public.revoke_client_file_share(_share_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  UPDATE public.client_file_shares
    SET revoked_at = now(), revoked_by = auth.uid(), updated_at = now()
    WHERE id = _share_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- =========================================================
-- 7. Public RPCs — client portal: verify PIN + fetch file
-- =========================================================

-- Verify PIN. Rate-limited: after 5 wrong tries, lock 30 min.
CREATE OR REPLACE FUNCTION public.portal_verify_client_file_pin(
  _token TEXT, _pin TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sh RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('error','invalid_pin_format');
  END IF;

  SELECT * INTO sh FROM public.client_file_shares WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF sh.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('error','revoked'); END IF;
  IF sh.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF sh.pin_locked_until IS NOT NULL AND sh.pin_locked_until > now() THEN
    RETURN jsonb_build_object('error','locked','until', sh.pin_locked_until);
  END IF;

  IF crypt(_pin, sh.pin_hash) = sh.pin_hash THEN
    UPDATE public.client_file_shares
      SET pin_verified_at = COALESCE(pin_verified_at, now()),
          pin_attempts = 0,
          pin_locked_until = NULL,
          updated_at = now()
      WHERE id = sh.id;
    RETURN jsonb_build_object('ok', true);
  ELSE
    UPDATE public.client_file_shares
      SET pin_attempts = pin_attempts + 1,
          pin_locked_until = CASE WHEN pin_attempts + 1 >= 5
            THEN now() + interval '30 minutes' ELSE pin_locked_until END,
          updated_at = now()
      WHERE id = sh.id;
    RETURN jsonb_build_object('error','wrong_pin','attempts_left', GREATEST(0, 5 - (sh.pin_attempts + 1)));
  END IF;
END $$;

-- Fetch the assembled client file. Requires token + PIN (client re-sends PIN each call).
CREATE OR REPLACE FUNCTION public.portal_get_client_file(
  _token TEXT, _pin TEXT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sh RECORD;
  proj RECORD;
  cli RECORD;
  photos JSONB;
  estimates JSONB;
  proposals JSONB;
  invoices JSONB;
  payments JSONB;
  change_orders JSONB;
  signatures JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('error','pin_required');
  END IF;

  SELECT * INTO sh FROM public.client_file_shares WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF sh.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('error','revoked'); END IF;
  IF sh.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF crypt(_pin, sh.pin_hash) <> sh.pin_hash THEN
    RETURN jsonb_build_object('error','wrong_pin');
  END IF;

  SELECT * INTO proj FROM public.projects WHERE id = sh.project_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','project_missing'); END IF;
  SELECT * INTO cli FROM public.clients WHERE id = proj.client_id;

  -- Only client-facing photos
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'storage_path', p.storage_path, 'caption', p.caption,
    'phase', p.phase, 'captured_at', p.captured_at
  ) ORDER BY p.captured_at DESC), '[]'::jsonb)
    INTO photos FROM public.project_photos p
    WHERE p.project_id = sh.project_id AND p.is_client_facing = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'grand_total', e.grand_total, 'status', e.status,
    'created_at', e.created_at
  ) ORDER BY e.created_at DESC), '[]'::jsonb)
    INTO estimates FROM public.estimates e WHERE e.project_id = sh.project_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pr.id, 'proposal_number', pr.proposal_number, 'status', pr.status,
    'sent_at', pr.sent_at, 'approved_at', pr.approved_at,
    'scope_of_work', pr.scope_of_work,
    'warranty_length', pr.warranty_length, 'warranty_notes', pr.warranty_notes,
    'exclusions', pr.exclusions, 'payment_terms', pr.payment_terms
  ) ORDER BY pr.created_at DESC), '[]'::jsonb)
    INTO proposals FROM public.proposals pr WHERE pr.project_id = sh.project_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'invoice_number', i.invoice_number, 'total', i.total,
    'balance_due', i.balance_due, 'status', i.status,
    'invoice_date', i.invoice_date, 'due_date', i.due_date
  ) ORDER BY i.invoice_date DESC), '[]'::jsonb)
    INTO invoices FROM public.invoices i
    WHERE i.project_id = sh.project_id AND i.status <> 'void';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'amount', p.amount, 'payment_date', p.payment_date, 'method', p.method
  ) ORDER BY p.payment_date DESC), '[]'::jsonb)
    INTO payments FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE i.project_id = sh.project_id AND p.is_void = false;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', co.id, 'description', co.description, 'amount', co.amount,
    'status', co.status, 'created_at', co.created_at
  ) ORDER BY co.created_at DESC), '[]'::jsonb)
    INTO change_orders FROM public.change_orders co WHERE co.project_id = sh.project_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'signer_name', s.signer_name, 'signed_at', s.created_at,
    'proposal_id', s.proposal_id
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
    INTO signatures FROM public.proposal_signatures s
    JOIN public.proposals pr ON pr.id = s.proposal_id
    WHERE pr.project_id = sh.project_id;

  -- Track the view
  UPDATE public.client_file_shares
    SET view_count = view_count + 1, last_viewed_at = now(), updated_at = now()
    WHERE id = sh.id;
  INSERT INTO public.client_file_share_views(share_id) VALUES (sh.id);

  RETURN jsonb_build_object(
    'project', jsonb_build_object(
      'name', proj.name,
      'address', proj.job_address,
      'city', proj.city, 'state', proj.state, 'zip', proj.zip,
      'description', proj.description
    ),
    'client', jsonb_build_object(
      'name', cli.name, 'email', cli.email, 'phone', cli.phone
    ),
    'photos', photos,
    'estimates', estimates,
    'proposals', proposals,
    'invoices', invoices,
    'payments', payments,
    'change_orders', change_orders,
    'signatures', signatures,
    'share', jsonb_build_object(
      'expires_at', sh.expires_at,
      'view_count', sh.view_count + 1
    )
  );
END $$;
