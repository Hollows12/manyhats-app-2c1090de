
-- Phase 3: Field capture metadata + voice notes + receipts + client-facing flags

-- 1. Extend project_photos with field metadata
ALTER TABLE public.project_photos
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS is_client_facing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposal_include boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gps_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS gps_lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_project_photos_phase ON public.project_photos(project_id, phase);
CREATE INDEX IF NOT EXISTS idx_project_photos_proposal_include ON public.project_photos(project_id) WHERE proposal_include = true;

-- 2. Extend voice_notes with client, summary, duration, category
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Receipts table (feeds job_costs)
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'material',
  vendor text,
  purchased_at date DEFAULT (now()::date),
  notes text,
  job_cost_id uuid REFERENCES public.job_costs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage receipts" ON public.receipts
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER receipts_set_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_receipts_project ON public.receipts(project_id, purchased_at DESC);

-- 4. Storage bucket for receipts uses existing field-photos bucket (already private)
