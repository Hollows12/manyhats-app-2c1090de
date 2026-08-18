-- Client portal bearer links, recipient details, PIN management, and access
-- telemetry are privileged security data. Crew members do not need direct
-- access to these records for field execution.

DROP POLICY IF EXISTS "Staff manage client file shares" ON public.client_file_shares;
CREATE POLICY "Admins manage client file shares"
  ON public.client_file_shares
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Staff read share views" ON public.client_file_share_views;
CREATE POLICY "Admins read share views"
  ON public.client_file_share_views
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

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
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  IF _expires_days IS NULL OR _expires_days < 1 OR _expires_days > 90 THEN
    _expires_days := 14;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id) THEN
    RETURN jsonb_build_object('error','project_not_found');
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

CREATE OR REPLACE FUNCTION public.rotate_client_file_share_pin(_share_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pin TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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

CREATE OR REPLACE FUNCTION public.revoke_client_file_share(_share_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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

REVOKE ALL ON FUNCTION public.create_client_file_share(UUID, TEXT, INT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_client_file_share_pin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_client_file_share(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_file_share(UUID, TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_client_file_share_pin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_client_file_share(UUID) TO authenticated;
