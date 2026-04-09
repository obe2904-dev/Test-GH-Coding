-- STEP 1: Add category column to businesses table
-- Run this in Supabase SQL Editor

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.category IS 'Specific business type (e.g., café, restaurant, bar, frisør)';
