
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'crew', 'client');

CREATE TYPE public.project_status AS ENUM (
  'lead','site_visit_scheduled','field_capture','estimating',
  'proposal_draft','proposal_sent','approved','active',
  'waiting_on_client','waiting_on_materials','complete','lost'
);

CREATE TYPE public.project_type AS ENUM (
  'custom_home','spec_home','barndominium','pole_barn_home','addition','garage',
  'basement_finish','whole_home_remodel','kitchen_remodel','bathroom_remodel','outdoor_living',
  'excavation','site_development','foundation','retaining_wall','utilities',
  'septic_install','septic_repair','driveway','drainage','stormwater',
  'decorative_concrete','stamped_concrete','concrete_flatwork','cmu_block',
  'masonry_restoration','historic_restoration','chimney_repair','stone_veneer',
  'commercial_buildout','office_renovation','retail_buildout','restaurant_buildout','museum_theater_church',
  'container_airbnb','container_home','container_game_room','container_theater_room',
  'hunting_cabin','short_term_rental','other'
);

CREATE TYPE public.estimate_category AS ENUM (
  'labor','material','equipment','subcontractor','fuel_travel',
  'permit','disposal','contingency','markup','other'
);

CREATE TYPE public.proposal_status AS ENUM ('draft','ready','sent','approved','rejected','expired');
CREATE TYPE public.concept_status AS ENUM ('draft','ready_to_generate','generated','approved','rejected');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============= USER ROLES (must come before profiles) =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','crew'));
$$;

CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'crew');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= CLIENTS =============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, city TEXT, state TEXT, zip TEXT, county TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_staff_all" ON public.clients FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "clients_client_self_read" ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.client_id = clients.id));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD CONSTRAINT profiles_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- ============= PROJECTS =============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_type public.project_type NOT NULL DEFAULT 'other',
  status public.project_status NOT NULL DEFAULT 'lead',
  job_address TEXT, city TEXT, state TEXT, zip TEXT, county TEXT,
  summary TEXT, site_notes TEXT, measurement_notes TEXT,
  budget_min NUMERIC, budget_max NUMERIC, desired_timeline TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_staff_all" ON public.projects FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "projects_client_read" ON public.projects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.client_id = projects.client_id));
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= PROJECT PHOTOS =============
CREATE TABLE public.project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_real_site_photo BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_photos TO authenticated;
GRANT ALL ON public.project_photos TO service_role;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_staff_all" ON public.project_photos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_photos_project ON public.project_photos(project_id);

-- ============= MEASUREMENTS =============
CREATE TABLE public.measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ea',
  notes TEXT,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurements TO authenticated;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "measurements_staff_all" ON public.measurements FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_measurements_project ON public.measurements(project_id);

CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT, transcript TEXT, scope_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_notes TO authenticated;
GRANT ALL ON public.voice_notes TO service_role;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_staff_all" ON public.voice_notes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.lidar_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scan_name TEXT NOT NULL,
  file_path TEXT, measurement_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lidar_scans TO authenticated;
GRANT ALL ON public.lidar_scans TO service_role;
ALTER TABLE public.lidar_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lidar_staff_all" ON public.lidar_scans FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============= ESTIMATES =============
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  markup_pct NUMERIC NOT NULL DEFAULT 15,
  contingency_pct NUMERIC NOT NULL DEFAULT 10,
  tax_pct NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_staff_all" ON public.estimates FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_estimates_project ON public.estimates(project_id);
CREATE TRIGGER trg_estimates_updated BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  category public.estimate_category NOT NULL DEFAULT 'labor',
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ea',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_line_items TO authenticated;
GRANT ALL ON public.estimate_line_items TO service_role;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elines_staff_all" ON public.estimate_line_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_estimate_lines_estimate ON public.estimate_line_items(estimate_id);

-- ============= PROPOSALS =============
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_number TEXT NOT NULL UNIQUE,
  status public.proposal_status NOT NULL DEFAULT 'draft',
  executive_summary TEXT, existing_conditions TEXT, scope_of_work TEXT,
  recommendation TEXT, timeline TEXT,
  warranty_length TEXT, warranty_notes TEXT, exclusions TEXT, payment_terms TEXT,
  grant_friendly BOOLEAN NOT NULL DEFAULT false,
  attached_photo_ids UUID[] NOT NULL DEFAULT '{}',
  attached_concept_ids UUID[] NOT NULL DEFAULT '{}',
  pdf_path TEXT, sent_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_staff_all" ON public.proposals FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "proposals_client_read" ON public.proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects pr JOIN public.profiles p ON p.client_id = pr.client_id
                 WHERE pr.id = proposals.project_id AND p.id = auth.uid()));
CREATE INDEX idx_proposals_project ON public.proposals(project_id);
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.proposal_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_options TO authenticated;
GRANT ALL ON public.proposal_options TO service_role;
ALTER TABLE public.proposal_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popts_staff_all" ON public.proposal_options FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "popts_client_read" ON public.proposal_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals pr JOIN public.projects pj ON pj.id = pr.project_id
                 JOIN public.profiles p ON p.client_id = pj.client_id
                 WHERE pr.id = proposal_options.proposal_id AND p.id = auth.uid()));

CREATE TABLE public.proposal_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signature_data TEXT,
  selected_option_id UUID REFERENCES public.proposal_options(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);
GRANT SELECT, INSERT ON public.proposal_signatures TO authenticated;
GRANT ALL ON public.proposal_signatures TO service_role;
ALTER TABLE public.proposal_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psigs_staff_all" ON public.proposal_signatures FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "psigs_client_insert" ON public.proposal_signatures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals pr JOIN public.projects pj ON pj.id = pr.project_id
                      JOIN public.profiles p ON p.client_id = pj.client_id
                      WHERE pr.id = proposal_signatures.proposal_id AND p.id = auth.uid()));

CREATE TABLE public.concept_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_photo_id UUID REFERENCES public.project_photos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  must_keep TEXT, requested_changes TEXT, measurement_notes TEXT,
  status public.concept_status NOT NULL DEFAULT 'draft',
  generated_image_path TEXT,
  approved_for_proposal BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_requests TO authenticated;
GRANT ALL ON public.concept_requests TO service_role;
ALTER TABLE public.concept_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concepts_staff_all" ON public.concept_requests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_concepts_updated BEFORE UPDATE ON public.concept_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= STORAGE POLICIES =============
CREATE POLICY "fp_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'field-photos' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'field-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "cp_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'concepts' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'concepts' AND public.is_staff(auth.uid()));
CREATE POLICY "pp_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'proposals-pdf' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'proposals-pdf' AND public.is_staff(auth.uid()));
