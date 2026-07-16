-- Add outdoor_seating_term column to business_operations
-- Stores the exact Danish term the business uses for outdoor seating

ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS outdoor_seating_term text;

COMMENT ON COLUMN business_operations.outdoor_seating_term IS 
'The exact Danish term the business uses for outdoor seating: terrasse, overdækket terrasse, haveplads, gårdhave, etc.';

-- Also add has_outdoor_seating if not exists (for completeness)
ALTER TABLE business_operations  
ADD COLUMN IF NOT EXISTS has_outdoor_seating boolean DEFAULT false;

COMMENT ON COLUMN business_operations.has_outdoor_seating IS
'Whether the business has outdoor seating available';

-- Add has_wifi and has_parking if they don''t exist (from Tier 2 keywords)
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS has_wifi boolean DEFAULT false;

ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS has_parking boolean DEFAULT false;

-- Add kitchen_close_time if not exists
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS kitchen_close_time time;

COMMENT ON COLUMN business_operations.kitchen_close_time IS
'Most common kitchen closing time across open days, derived from opening hours';

-- Add smiley_url if not exists  
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS smiley_url text;

COMMENT ON COLUMN business_operations.smiley_url IS
'URL to Danish food inspection (Smiley) rating';

-- Add weekly_programme if not exists
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS weekly_programme text;

COMMENT ON COLUMN business_operations.weekly_programme IS
'Free text describing recurring weekly events: live music, DJ nights, themed evenings, brunch days, etc.';
