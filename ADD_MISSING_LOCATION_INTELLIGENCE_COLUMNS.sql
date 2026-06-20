-- ============================================================================
-- ADD MISSING COLUMNS TO BUSINESS_LOCATION_INTELLIGENCE
-- ============================================================================
-- The code expects these columns but they don't exist in production
-- This is causing PGRST204 errors when trying to save location analysis
-- ============================================================================

-- Add category_scores column (stores all location type match scores)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;

-- Add location_type_matches column (stores STEP 1 pure location analysis)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS location_type_matches JSONB DEFAULT '{}'::jsonb;

-- Add concept_fit_by_category column (stores STEP 2 concept fit analysis per category)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS concept_fit_by_category JSONB DEFAULT '{}'::jsonb;

-- Add concept_fit_analyzed_at timestamp (tracks when concept fit was analyzed)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS concept_fit_analyzed_at TIMESTAMPTZ;

-- Refresh PostgREST schema cache so it recognizes the new columns
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all columns after adding
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- Confirm the new columns exist
SELECT 
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'category_scores') as category_scores_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'location_type_matches') as location_type_matches_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'concept_fit_by_category') as concept_fit_by_category_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'concept_fit_analyzed_at') as concept_fit_analyzed_at_exists;
