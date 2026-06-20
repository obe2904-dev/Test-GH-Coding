-- ============================================================================
-- FULL LAYER 0 INTELLIGENCE - CAFE FAUST
-- ============================================================================

-- Get the complete Layer 0 intelligence structure (pretty printed)
SELECT 
  jsonb_pretty(brand_profile_v5->'layer_0_intelligence') as layer_0_complete
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
