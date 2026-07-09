-- Migration 013: Brand Profile Auto-Extracted Signals
-- Adds fields to business_brand_profile for WHO/WHEN/WHY inference

-- Add new columns to business_brand_profile table
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS has_alcohol BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS price_level TEXT CHECK (price_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS dietary_options TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS signature_items TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dominant_usage_mode TEXT CHECK (dominant_usage_mode IN ('breakfast', 'lunch', 'dinner', 'evening', 'night', 'allday')),
ADD COLUMN IF NOT EXISTS opens_early BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS closes_late BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS weekend_focused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS target_audiences TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.business_brand_profile.has_alcohol IS 'Auto-detected: Does this business serve alcohol (extracted from offerings)';
COMMENT ON COLUMN public.business_brand_profile.price_level IS 'Price positioning: low, medium, or high (can be manually set or inferred from offerings.price_min/max)';
COMMENT ON COLUMN public.business_brand_profile.dietary_options IS 'Auto-detected: Dietary tags like vegan, gluten-free (extracted from offerings)';
COMMENT ON COLUMN public.business_brand_profile.signature_items IS 'Auto-detected: Top signature items/services (extracted from offerings)';
COMMENT ON COLUMN public.business_brand_profile.dominant_usage_mode IS 'Auto-detected: Primary time-of-day usage (extracted from opening_hours)';
COMMENT ON COLUMN public.business_brand_profile.opens_early IS 'Auto-detected: Opens before 8am (extracted from opening_hours)';
COMMENT ON COLUMN public.business_brand_profile.closes_late IS 'Auto-detected: Closes after 10pm (extracted from opening_hours)';
COMMENT ON COLUMN public.business_brand_profile.weekend_focused IS 'Auto-detected: Primarily weekend business (extracted from opening_hours)';
COMMENT ON COLUMN public.business_brand_profile.target_audiences IS 'Auto-inferred WHO: Target audience segments (Locals, Tourists, Families, etc.)';

-- Create index for target_audiences array queries
CREATE INDEX IF NOT EXISTS idx_brand_profile_target_audiences ON public.business_brand_profile USING GIN (target_audiences);
