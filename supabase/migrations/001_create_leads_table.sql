-- Create lead_status enum
CREATE TYPE lead_status AS ENUM ('hot', 'warm', 'cold');

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT NOT NULL,
  title       TEXT NOT NULL,
  linkedin_url TEXT,
  score       INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status      lead_status NOT NULL DEFAULT 'cold',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_leads_status     ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_score      ON public.leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email      ON public.leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all leads
CREATE POLICY "Authenticated users can read leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can insert leads
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can update leads
CREATE POLICY "Authenticated users can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: authenticated users can delete leads
CREATE POLICY "Authenticated users can delete leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (true);

-- Policy: service role bypasses RLS (implicit, but documented here)
-- The service role key in createAdminClient() always bypasses RLS.
