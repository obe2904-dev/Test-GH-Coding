-- ============================================================================
-- REFRESH K-BBQ LOCATION INTELLIGENCE TO V2 SCHEMA
-- ============================================================================
-- Purpose: Delete old v1 location intelligence data and trigger regeneration
--          with AI+web search using new v2 split schema
-- Business: KOREAN BBQ & SUSHI (Silkeborg)
-- Date: 2026-06-26
-- ============================================================================

-- Step 1: Check current location intelligence data
SELECT 
  bli.business_id,
  b.name,
  bli.category_scores,
  bli.demographic_proximity,
  bli.area_type,
  bli.schema_version,
  bli.updated_at
FROM business_location_intelligence bli
JOIN businesses b ON b.id = bli.business_id
WHERE bli.business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Step 2: DELETE old v1 location intelligence
-- This will trigger regeneration via populate-location-intelligence function
DELETE FROM business_location_intelligence
WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Step 3: Verify deletion
SELECT 
  bli.business_id,
  b.name
FROM business_location_intelligence bli
JOIN businesses b ON b.id = bli.business_id
WHERE bli.business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Expected result: 0 rows (ready for regeneration)

-- ============================================================================
-- NEXT STEPS (Manual):
-- ============================================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Trigger populate-location-intelligence via API:
--    curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence \
--      -H "Content-Type: application/json" \
--      -d '{"business_id": "95d657ad-d791-422b-ad40-ec7a5f1c2b0c"}'
-- 3. Verify new v2 schema data populated with:
--    - schema_version = 2
--    - demographic_proximity.student ≈ 20 (not 88)
--    - category_scores contains only geographic dimensions
-- ============================================================================
