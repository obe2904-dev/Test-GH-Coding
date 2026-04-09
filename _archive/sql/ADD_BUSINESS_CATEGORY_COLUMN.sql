-- Add category column to businesses table
-- This stores the specific business type like "café", "restaurant", "bar", etc.
-- while vertical stores the broader category like "hospitality", "retail", etc.

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.businesses.category IS 'Specific business type (e.g., café, restaurant, bar, frisør) - used for AI context';

-- For existing businesses, copy vertical to category as a starting point
UPDATE public.businesses
SET category = vertical
WHERE category IS NULL;
