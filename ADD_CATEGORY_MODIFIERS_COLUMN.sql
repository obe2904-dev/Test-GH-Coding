-- ============================================================================
-- ADD CATEGORY_MODIFIERS COLUMN TO BUSINESS_LOCATION_INTELLIGENCE
-- ============================================================================
-- Stores qualifiers for location categories (e.g., city_centre + shopping)
-- This allows rich category context without category bloat
-- ============================================================================

-- Add category_modifiers column (maps category -> array of modifiers)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS category_modifiers JSONB DEFAULT '{}'::jsonb;

-- Example structure:
-- {
--   "city_centre": ["shopping", "cultural"],
--   "waterfront": ["dining", "recreational"]
-- }

COMMENT ON COLUMN business_location_intelligence.category_modifiers IS 
  'Qualifiers for location categories. Example: {"city_centre": ["shopping"]} indicates city centre with strong shopping context';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Confirm column exists
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
  AND column_name = 'category_modifiers';

-- Show current data (should be empty/default for existing rows)
SELECT 
  business_id,
  area_type,
  category_modifiers
FROM business_location_intelligence
LIMIT 5;
