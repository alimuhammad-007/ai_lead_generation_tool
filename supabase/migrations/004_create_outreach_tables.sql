-- ─────────────────────────────────────────────────────────────────
-- outreach_sequences — one per lead "campaign"
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sequences_lead_id
  ON public.outreach_sequences (lead_id);

CREATE INDEX IF NOT EXISTS idx_outreach_sequences_status
  ON public.outreach_sequences (status);

-- ─────────────────────────────────────────────────────────────────
-- outreach_emails — individual email steps (steps 1/2/3)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_emails (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id     UUID        REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
  step            INTEGER     NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 10),
  subject         TEXT        NOT NULL,
  body_html       TEXT        NOT NULL,
  body_text       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','opened','replied','bounced','failed')),
  tracking_token  TEXT        UNIQUE,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_emails_lead_id
  ON public.outreach_emails (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_sequence_id
  ON public.outreach_emails (sequence_id);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_status
  ON public.outreach_emails (status);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_tracking_token
  ON public.outreach_emails (tracking_token);
-- Used by the "process due emails" query
CREATE INDEX IF NOT EXISTS idx_outreach_emails_scheduled_pending
  ON public.outreach_emails (scheduled_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_emails    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage outreach_sequences"
  ON public.outreach_sequences FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage outreach_emails"
  ON public.outreach_emails FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Tracking pixel endpoint runs as service role → no policy needed for anon reads
-- (the admin client bypasses RLS)
