-- clients: one row per paying/trial customer of the SaaS
CREATE TABLE IF NOT EXISTS public.clients (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  email                  TEXT NOT NULL UNIQUE,
  company                TEXT NOT NULL,
  plan                   TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro')),
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status    TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_plan       ON public.clients (plan);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clients"
  ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attach leads to a client (nullable — existing leads keep null)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id UUID
    REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads (client_id);
