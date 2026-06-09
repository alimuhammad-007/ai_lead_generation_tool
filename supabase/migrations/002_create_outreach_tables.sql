-- outreach_email_status enum
CREATE TYPE outreach_email_status AS ENUM ('scheduled', 'sent', 'opened', 'replied', 'failed');

-- campaigns
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.outreach_campaigns (created_at DESC);

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage campaigns"
  ON public.outreach_campaigns FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- outreach emails (one row per individual email, whether scheduled or sent)
CREATE TABLE IF NOT EXISTS public.outreach_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  sequence_day  INTEGER CHECK (sequence_day IN (1, 3, 7)),  -- null = one-off send
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,   -- plain text
  html          TEXT NOT NULL,   -- HTML with tracking pixel
  status        outreach_email_status NOT NULL DEFAULT 'scheduled',
  tracking_id   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_lead_id     ON public.outreach_emails (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign_id ON public.outreach_emails (campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_id ON public.outreach_emails (tracking_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status      ON public.outreach_emails (status);
CREATE INDEX IF NOT EXISTS idx_outreach_scheduled   ON public.outreach_emails (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_outreach_created_at  ON public.outreach_emails (created_at DESC);

ALTER TABLE public.outreach_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage outreach emails"
  ON public.outreach_emails FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
