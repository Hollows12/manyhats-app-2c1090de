
-- CHANGE ORDERS
CREATE TABLE public.change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number INT NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  reason TEXT,
  price_change NUMERIC NOT NULL DEFAULT 0,
  timeline_change_days INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  client_signature TEXT,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_orders TO authenticated;
GRANT ALL ON public.change_orders TO service_role;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co_staff_all" ON public.change_orders FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- DAILY LOGS
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weather TEXT,
  crew_notes TEXT,
  subcontractor_notes TEXT,
  material_notes TEXT,
  equipment_notes TEXT,
  progress_notes TEXT,
  client_communication TEXT,
  hours_worked NUMERIC,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dl_staff_all" ON public.daily_logs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- JOB TASKS
CREATE TABLE public.job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tasks TO authenticated;
GRANT ALL ON public.job_tasks TO service_role;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_staff_all" ON public.job_tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- JOB COSTS (one row per category per project)
CREATE TABLE public.job_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category public.estimate_category NOT NULL,
  estimated NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_costs TO authenticated;
GRANT ALL ON public.job_costs TO service_role;
ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jc_staff_all" ON public.job_costs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- KNOWLEDGE BASE
CREATE TABLE public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_type public.project_type NOT NULL,
  title TEXT NOT NULL,
  final_scope TEXT,
  estimated_total NUMERIC,
  actual_total NUMERIC,
  labor_hours NUMERIC,
  margin_pct NUMERIC,
  lessons_learned TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_entries TO authenticated;
GRANT ALL ON public.knowledge_entries TO service_role;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_staff_all" ON public.knowledge_entries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_kb_type ON public.knowledge_entries(project_type);

-- MATERIAL COSTS (local pricing placeholder)
CREATE TABLE public.material_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'ea',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  zip TEXT,
  county TEXT,
  state TEXT,
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_costs TO authenticated;
GRANT ALL ON public.material_costs TO service_role;
ALTER TABLE public.material_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mat_staff_read" ON public.material_costs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "mat_admin_write" ON public.material_costs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mat_admin_update" ON public.material_costs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mat_admin_delete" ON public.material_costs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTION RATES
CREATE TABLE public.production_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type TEXT NOT NULL,
  crew_size INT NOT NULL DEFAULT 2,
  equipment TEXT,
  unit TEXT NOT NULL DEFAULT 'sf',
  rate_per_day NUMERIC,
  labor_hours_per_unit NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_rates TO authenticated;
GRANT ALL ON public.production_rates TO service_role;
ALTER TABLE public.production_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_staff_read" ON public.production_rates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "pr_admin_write" ON public.production_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SPECIALTY: HOME BUILDS
CREATE TABLE public.home_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  preconstruction JSONB NOT NULL DEFAULT '{}'::jsonb,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  closeout JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_builds TO authenticated;
GRANT ALL ON public.home_builds TO service_role;
ALTER TABLE public.home_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hb_staff_all" ON public.home_builds FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_hb_updated BEFORE UPDATE ON public.home_builds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SPECIALTY: CONTAINER BUILDS
CREATE TABLE public.container_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  container_size TEXT,
  container_count INT,
  layout_notes TEXT,
  foundation_type TEXT,
  roof_type TEXT,
  utility_plan TEXT,
  insulation TEXT,
  interior_finish TEXT,
  exterior_paint TEXT,
  deck_patio TEXT,
  landscaping TEXT,
  airbnb_use_case TEXT,
  signage TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_builds TO authenticated;
GRANT ALL ON public.container_builds TO service_role;
ALTER TABLE public.container_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_staff_all" ON public.container_builds FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_cb_updated BEFORE UPDATE ON public.container_builds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SPECIALTY: HISTORIC RESTORATION
CREATE TABLE public.historic_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  building_age TEXT,
  historic_notes TEXT,
  masonry_damage TEXT,
  window_condition TEXT,
  water_intrusion TEXT,
  structural_concerns TEXT,
  safety_concerns TEXT,
  grant_notes TEXT,
  phased_plan TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historic_projects TO authenticated;
GRANT ALL ON public.historic_projects TO service_role;
ALTER TABLE public.historic_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hp_staff_all" ON public.historic_projects FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_hp_updated BEFORE UPDATE ON public.historic_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SPECIALTY: SEPTIC
CREATE TABLE public.septic_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  tank_location TEXT,
  gps_points TEXT,
  leach_field_layout TEXT,
  setbacks TEXT,
  drainage_notes TEXT,
  soil_notes TEXT,
  permit_notes TEXT,
  inspection_notes TEXT,
  maintenance_notes TEXT,
  as_built_notes TEXT,
  sensor_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.septic_projects TO authenticated;
GRANT ALL ON public.septic_projects TO service_role;
ALTER TABLE public.septic_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_staff_all" ON public.septic_projects FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_sp_updated BEFORE UPDATE ON public.septic_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
