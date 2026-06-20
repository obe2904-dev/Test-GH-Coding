-- Diagnostic: Check Café Faust location data
-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

-- STEP 1: Check what columns actually exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- ===== QUESTION 1: How many location records exist? =====
SELECT 
  COUNT(*) as location_count,
  business_id
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
GROUP BY business_id;

-- Expected: 1 row (system limitation)
-- Reality: Café Faust has 3 physical locations

-- ===== QUESTION 2: What location data is the AI using? =====
SELECT *
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ===== KEY FINDINGS FROM QUERY ABOVE =====
-- 1. Only 1 location record exists (confirmed)
-- 2. Multi-location data IS in the record via "concept_fit_by_category":
--    - waterfront (score: 100, is_strategy_driver: true)
--    - city_centre (score: 65)
--    - tourist (score: 60)
-- 3. Competition data EXISTS but code looks for wrong field names:
--    - ❌ Code expects: competition_density, competition_count
--    - ✅ Database has: nearby_hospitality.density_label = "high"
--    - ✅ Database has: nearby_hospitality.total_count = 16
-- 4. Result: AI receives NO competition data (fields are undefined)

-- ===== THE FIX =====
-- See: CODE-DATABASE-MISMATCH-ANALYSIS.md for complete analysis
-- Edge Function needs to use:
--   location?.nearby_hospitality?.density_label  (not competition_density)
--   location?.nearby_hospitality?.total_count    (not competition_count)

