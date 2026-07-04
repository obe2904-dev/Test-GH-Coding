-- ============================================================================
-- PHASE 1: CONTENT-TIMING SUPPORT - ESSENTIAL SCHEMA CHANGES
-- ============================================================================
-- Execute this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql
--
-- These are the minimum changes needed to enable content-timing validation
-- ============================================================================

-- 1. Add archetype to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'casual_dining';

-- 2. Add country code to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'DK';

-- 3. Add validation tracking to daily_suggestions
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

-- 4. Add inferred content type to daily_suggestions
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;

-- 5. Add programme_archetype to business_operations (for programme-level overrides)
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS programme_archetype TEXT;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_archetype ON businesses(archetype);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country_code);
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation ON daily_suggestions USING GIN (validation_result);
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type ON daily_suggestions(inferred_content_type);

-- 7. Set Cafe Faust archetype (if exists)
UPDATE businesses 
SET archetype = 'cafe_bar', country_code = 'DK'
WHERE LOWER(name) LIKE '%faust%';

-- 8. Verify changes
SELECT 
  'businesses' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name IN ('archetype', 'country_code')
UNION ALL
SELECT 
  'daily_suggestions' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
  AND column_name IN ('validation_result', 'inferred_content_type')
UNION ALL
SELECT 
  'business_operations' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_operations'
  AND column_name = 'programme_archetype'
ORDER BY table_name, column_name;
