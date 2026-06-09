-- Stores the AI-generated reasoning for the lead's score
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_reason TEXT;
