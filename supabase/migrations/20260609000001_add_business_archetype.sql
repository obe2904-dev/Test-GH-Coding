-- Add business_archetype enum and column to business_brand_profile
-- This provides explicit validated classification instead of runtime inference

-- Create enum type for business archetype (if not exists)
DO $$ BEGIN
  CREATE TYPE business_archetype_enum AS ENUM (
    'fine_dining',
    'casual_dining',
    'cafe_bistro',
    'cafe_bar',
    'restaurant_bar',
    'wine_bar',
    'coffee_shop',
    'quick_service',
    'bakery',
    'morning_cafe',
    'brunch_cafe',
    'all_day_cafe',
    'lunch_restaurant',
    'dinner_restaurant',
    'full_service_restaurant',
    'evening_bar',
    'late_night_bar',
    'nightlife_bar',
    'brunch_specialist',
    'fast_casual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add column to business_brand_profile
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS business_archetype business_archetype_enum;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN business_brand_profile.business_archetype IS 
  'Explicit validated business archetype - determines content strategy defaults and timing recommendations. Auto-detected during brand profile generation from service_periods, opening hours, and menu programmes. Stored persistently to ensure consistent strategy week-to-week.';

-- Create index for archetype-based queries
CREATE INDEX IF NOT EXISTS idx_brand_profile_archetype 
  ON business_brand_profile(business_archetype) 
  WHERE business_archetype IS NOT NULL;
