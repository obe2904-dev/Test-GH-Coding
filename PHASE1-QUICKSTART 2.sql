-- ============================================================================
-- PHASE 1: QUICK START - Copy and paste this entire file into Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql
-- ============================================================================

-- Step 1: Add new columns to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'casual_dining';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'DK';

-- Step 2: Add new columns to daily_suggestions table  
ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS validation_result JSONB;
ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;

-- Step 3: Add programme archetype to business_operations
ALTER TABLE business_operations ADD COLUMN IF NOT EXISTS programme_archetype TEXT;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_archetype ON businesses(archetype);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country_code);
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation ON daily_suggestions USING GIN (validation_result);
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type ON daily_suggestions(inferred_content_type);

-- Step 5: Set Cafe Faust to cafe_bar archetype (hybrid: cafe by day, bar by night)
UPDATE businesses 
SET archetype = 'cafe_bar', country_code = 'DK'
WHERE LOWER(name) LIKE '%faust%';

-- Step 6: Smart defaults for other businesses (optional - review before uncommenting)
-- Uncomment the sections you want to apply:

-- Bars and nightlife venues
-- UPDATE businesses SET archetype = 'nightlife_bar' 
-- WHERE archetype = 'casual_dining' 
-- AND (LOWER(name) LIKE '%bar%' OR LOWER(description) LIKE '%cocktail%' OR LOWER(description) LIKE '%nightlife%');

-- Brunch specialists
-- UPDATE businesses SET archetype = 'brunch_specialist'
-- WHERE archetype = 'casual_dining'
-- AND (LOWER(name) LIKE '%brunch%' OR LOWER(description) LIKE '%weekend brunch%');

-- Fine dining
-- UPDATE businesses SET archetype = 'fine_dining'
-- WHERE archetype = 'casual_dining'
-- AND (LOWER(description) LIKE '%fine dining%' OR LOWER(description) LIKE '%michelin%' OR LOWER(description) LIKE '%tasting menu%');

-- Bakeries and cafes
-- UPDATE businesses SET archetype = 'bakery_cafe'
-- WHERE archetype = 'casual_dining'
-- AND (LOWER(name) LIKE '%bageri%' OR LOWER(name) LIKE '%bakery%' OR LOWER(description) LIKE '%pastries%');

-- Fast casual
-- UPDATE businesses SET archetype = 'fast_casual'
-- WHERE archetype = 'casual_dining'
-- AND (LOWER(description) LIKE '%fast casual%' OR LOWER(description) LIKE '%quick service%');

-- Step 7: Verify the changes
SELECT 
  'SCHEMA VERIFICATION' as status,
  COUNT(*) FILTER (WHERE column_name = 'archetype' AND table_name = 'businesses') as businesses_archetype,
  COUNT(*) FILTER (WHERE column_name = 'country_code' AND table_name = 'businesses') as businesses_country,
  COUNT(*) FILTER (WHERE column_name = 'programme_archetype' AND table_name = 'business_operations') as operations_programme_arch,
  COUNT(*) FILTER (WHERE column_name = 'validation_result' AND table_name = 'daily_suggestions') as suggestions_validation,
  COUNT(*) FILTER (WHERE column_name = 'inferred_content_type' AND table_name = 'daily_suggestions') as suggestions_content_type
FROM information_schema.columns
WHERE table_name IN ('businesses', 'business_operations', 'daily_suggestions')
  AND column_name IN ('archetype', 'country_code', 'programme_archetype', 'validation_result', 'inferred_content_type');

-- Step 8: Check business archetypes
SELECT 
-- Step 8: Check business archetypes
SELECT 
  'BUSINESS ARCHETYPES' as report,
  archetype,
  country_code,
  COUNT(*) as count
FROM businesses
GROUP BY archetype, country_code
ORDER BY count DESC;

-- Step 9: Find Cafe Faust and verify its archetype
SELECT 
  'CAFE FAUST CHECK' as report,
  id,
  name,
  archetype,
  country_code
FROM businesses
WHERE LOWER(name) LIKE '%faust%';

-- ============================================================================
-- EXPECTED OUTPUT:
-- 
-- Row 1 (SCHEMA VERIFICATION): All 5 columns should show count of 1
-- Row 2-N (BUSINESS ARCHETYPES): Distribution of archetypes by country
-- Last Row (CAFE FAUST CHECK): Should show archetype='cafe_bar', country_code='DK'
--
-- If all checks pass, Phase 1 schema is ready! ✅
-- ============================================================================
