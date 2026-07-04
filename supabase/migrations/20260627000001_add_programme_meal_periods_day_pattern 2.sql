-- Migration: Add meal_periods and day_pattern to business_programme_profiles
-- Date: 2026-06-27
-- Purpose: Support daypart-aware audience segmentation

-- Add meal_periods column (array of meal period types this programme covers)
ALTER TABLE business_programme_profiles 
  ADD COLUMN IF NOT EXISTS meal_periods text[] DEFAULT '{}';

-- Add day_pattern column (operating day pattern)
ALTER TABLE business_programme_profiles 
  ADD COLUMN IF NOT EXISTS day_pattern text;

-- Add comments for documentation
COMMENT ON COLUMN business_programme_profiles.meal_periods IS 
  'Meal periods this programme covers based on time window overlap (60-min minimum). Values: morgenmad, brunch, frokost, eftermiddag, aftensmad, natbar. Derived automatically from time_windows.';

COMMENT ON COLUMN business_programme_profiles.day_pattern IS 
  'Operating day pattern derived from operating_days. Values: all_week, weekday, weekend, weekend_heavy. Used for audience segmentation.';
