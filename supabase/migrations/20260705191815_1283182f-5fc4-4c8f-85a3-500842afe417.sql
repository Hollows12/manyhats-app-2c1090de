
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_email_idx ON public.invitations (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER invitations_set_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Accept an invitation: validates token, matches email, assigns role, marks accepted.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invitations%ROWTYPE;
  uid uuid := auth.uid();
  user_email text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  -- Replace auto-assigned role with invited role
  DELETE FROM public.user_roles WHERE user_id = uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, inv.role);

  UPDATE public.invitations
    SET accepted_at = now(), accepted_by = uid, updated_at = now()
    WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'role', inv.role);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- Fetch invitation preview by token (public, safe fields only)
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'email', email,
    'role', role,
    'expires_at', expires_at,
    'accepted_at', accepted_at
  )
  FROM public.invitations WHERE token = _token;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;
