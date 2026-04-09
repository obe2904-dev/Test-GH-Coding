-- COPY AND PASTE THIS ENTIRE SQL INTO YOUR SUPABASE SQL EDITOR
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Click RUN

-- Add all 9 brand voice columns + lifecycle tracking
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS brand_essence TEXT,
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
  ADD COLUMN IF NOT EXISTS things_to_avoid TEXT,
  ADD COLUMN IF NOT EXISTS core_offerings TEXT,
  ADD COLUMN IF NOT EXISTS content_focus TEXT,
  ADD COLUMN IF NOT EXISTS cta_style TEXT,
  ADD COLUMN IF NOT EXISTS communication_goal TEXT,
  ADD COLUMN IF NOT EXISTS image_preferences TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
  AND table_schema = 'public'
ORDER BY column_name;
