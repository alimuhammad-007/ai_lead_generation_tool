-- Add 'unscored' to the lead_status enum
-- (postgres requires this outside a transaction block in older versions;
--  Supabase/pg15+ handles it fine in a migration)
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'unscored';

-- Unique constraint on email for upsert-based deduplication
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_unique UNIQUE (email);
