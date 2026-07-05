
-- Enums
CREATE TYPE public.ai_recommendation_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.firecrawl_job_kind AS ENUM ('supplier_discovery','material_enrichment','price_refresh','knowledge_import');
CREATE TYPE public.firecrawl_job_status AS ENUM ('queued','running','succeeded','failed');
CREATE TYPE public.knowledge_doc_kind AS ENUM ('install','spec','sds','warranty','practice','safety','other');

-- Helper: reuse existing set_updated_at() trigger fn

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  zip TEXT,
  county TEXT,
  state TEXT,
  distance_mi NUMERIC,
  hours TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX suppliers_zip_idx ON public.suppliers(zip);
CREATE INDEX suppliers_categories_idx ON public.suppliers USING GIN(categories);

-- MATERIALS
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manufacturer TEXT,
  description TEXT,
  coverage TEXT,
  yield TEXT,
  weight TEXT,
  dimensions TEXT,
  colors TEXT[] NOT NULL DEFAULT '{}',
  compatible_with TEXT[] NOT NULL DEFAULT '{}',
  install_instructions TEXT,
  tds_url TEXT,
  warranty TEXT,
  sds_url TEXT,
  image_url TEXT,
  upc TEXT,
  sku TEXT,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read materials" ON public.materials FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write materials" ON public.materials FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX materials_name_idx ON public.materials(name);

-- MATERIAL PRICES (history-preserving)
CREATE TABLE public.material_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price_date DATE NOT NULL DEFAULT (now()::date),
  availability TEXT,
  product_url TEXT,
  source TEXT NOT NULL DEFAULT 'firecrawl',
  price_confidence NUMERIC CHECK (price_confidence IS NULL OR (price_confidence >= 0 AND price_confidence <= 1)),
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_prices TO authenticated;
GRANT ALL ON public.material_prices TO service_role;
ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read prices" ON public.material_prices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write prices" ON public.material_prices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX material_prices_material_idx ON public.material_prices(material_id, retrieved_at DESC);

-- CONTRACTOR SERVICE AREAS
CREATE TABLE public.contractor_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zip TEXT NOT NULL,
  radius_mi INTEGER NOT NULL DEFAULT 40,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_service_areas TO authenticated;
GRANT ALL ON public.contractor_service_areas TO service_role;
ALTER TABLE public.contractor_service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own service areas" ON public.contractor_service_areas FOR ALL TO authenticated USING (contractor_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (contractor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_service_areas_updated BEFORE UPDATE ON public.contractor_service_areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PREFERRED VENDORS
CREATE TABLE public.preferred_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  trade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, supplier_id, trade)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferred_vendors TO authenticated;
GRANT ALL ON public.preferred_vendors TO service_role;
ALTER TABLE public.preferred_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferred vendors" ON public.preferred_vendors FOR ALL TO authenticated USING (contractor_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (contractor_id = auth.uid() OR public.is_staff(auth.uid()));

-- AI ESTIMATE RECOMMENDATIONS
CREATE TABLE public.ai_estimate_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status public.ai_recommendation_status NOT NULL DEFAULT 'pending',
  confidence NUMERIC,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_estimate_recommendations TO authenticated;
GRANT ALL ON public.ai_estimate_recommendations TO service_role;
ALTER TABLE public.ai_estimate_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage ai recs" ON public.ai_estimate_recommendations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_ai_recs_updated BEFORE UPDATE ON public.ai_estimate_recommendations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ai_recs_project_idx ON public.ai_estimate_recommendations(project_id, created_at DESC);

-- FIRECRAWL JOBS (audit)
CREATE TABLE public.firecrawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.firecrawl_job_kind NOT NULL,
  target TEXT NOT NULL,
  status public.firecrawl_job_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result_summary JSONB,
  error TEXT,
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firecrawl_jobs TO authenticated;
GRANT ALL ON public.firecrawl_jobs TO service_role;
ALTER TABLE public.firecrawl_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read jobs" ON public.firecrawl_jobs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write jobs" ON public.firecrawl_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX firecrawl_jobs_created_idx ON public.firecrawl_jobs(created_at DESC);

-- KNOWLEDGE DOCS
CREATE TABLE public.knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  kind public.knowledge_doc_kind NOT NULL DEFAULT 'other',
  body_md TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_docs TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read knowledge" ON public.knowledge_docs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write knowledge" ON public.knowledge_docs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_knowledge_updated BEFORE UPDATE ON public.knowledge_docs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX knowledge_tags_idx ON public.knowledge_docs USING GIN(tags);
