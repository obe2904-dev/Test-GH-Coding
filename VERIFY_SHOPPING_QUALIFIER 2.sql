-- ============================================================================
-- VERIFICATION QUERY: City Centre + Shopping Qualifier Implementation
-- ============================================================================
-- Run this after deploying to verify shopping detection and concept-fit enhancement
-- ============================================================================

-- Check Café Faust's location intelligence with category modifiers
SELECT 
  b.name AS business_name,
  bli.area_type AS primary_category,
  bli.category_scores->>'city_centre' AS city_centre_score,
  bli.category_scores->>'waterfront' AS waterfront_score,
  bli.category_modifiers AS all_modifiers,
  bli.category_modifiers->'city_centre' AS city_centre_modifiers,
  bli.last_updated_by_ai,
  
  -- Extract concept-fit reasons for city_centre
  bli.concept_fit_by_category->'city_centre'->>'overall_fit_level' AS city_centre_fit_level,
  bli.concept_fit_by_category->'city_centre'->'motivation_fit'->>'level' AS motivation_fit_level,
  
  -- Show detected motivations (should include shopping-related ones)
  jsonb_pretty(bli.concept_fit_by_category->'city_centre'->'motivation_fit'->'detected_motivations') AS detected_motivations
  
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';


-- ============================================================================
-- SHOPPING MODIFIER VALIDATION
-- ============================================================================

-- Check all businesses with shopping modifiers
SELECT 
  b.name,
  bli.area_type,
  bli.category_scores->>'city_centre' AS city_centre_score,
  bli.category_modifiers->'city_centre' AS city_centre_modifiers,
  bli.neighborhood
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE bli.category_modifiers->'city_centre' @> '["shopping"]'::jsonb
ORDER BY bli.last_updated_by_ai DESC;


-- ============================================================================
-- CATEGORY SCORES vs MODIFIERS COMPARISON
-- ============================================================================

-- Show relationship between scores and modifiers
SELECT 
  b.name,
  bli.category_scores,
  bli.category_modifiers,
  bli.neighborhood,
  bli.last_updated_by_ai
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE bli.category_modifiers IS NOT NULL 
  AND bli.category_modifiers != '{}'::jsonb
ORDER BY bli.last_updated_by_ai DESC
LIMIT 20;


-- ============================================================================
-- SHOPPING-SPECIFIC MOTIVATION DETECTION
-- ============================================================================

-- Find businesses where shopping motivations were detected
SELECT 
  b.name,
  bli.area_type,
  bli.category_modifiers->'city_centre' AS modifiers,
  
  -- Extract motivation reasons containing shopping keywords
  jsonb_array_elements_text(
    bli.concept_fit_by_category->'city_centre'->'motivation_fit'->'reasons'
  ) AS motivation_reason
  
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE bli.concept_fit_by_category->'city_centre'->'motivation_fit'->'reasons' IS NOT NULL
  AND bli.category_modifiers->'city_centre' @> '["shopping"]'::jsonb
  
  -- Filter for shopping-related motivations
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(bli.concept_fit_by_category->'city_centre'->'motivation_fit'->'reasons') AS reason
    WHERE reason->>'text' ILIKE '%shopping%'
       OR reason->>'text' ILIKE '%indkøb%'
  );


-- ============================================================================
-- QUALITY CHECK: False Positive Detection
-- ============================================================================

-- Find businesses with shopping modifier but low shopping POI density
-- (Should be rare - indicates potential false positive)
SELECT 
  b.name,
  bli.neighborhood,
  bli.category_scores->>'city_centre' AS city_centre_score,
  bli.category_modifiers->'city_centre' AS modifiers,
  bli.landmarks_nearby
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE bli.category_modifiers->'city_centre' @> '["shopping"]'::jsonb
  
  -- Check if landmarks include major shopping venues
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(bli.landmarks_nearby) AS landmark
    WHERE landmark->>'type' ILIKE '%shopping%'
       OR landmark->>'type' ILIKE '%department_store%'
  );


-- ============================================================================
-- EXPECTED RESULTS FOR CAFÉ FAUST
-- ============================================================================

/*
After running populate-location-intelligence with force_refresh=true:

business_name: Café Faust
primary_category: waterfront
city_centre_score: 65
waterfront_score: 100
all_modifiers: {"city_centre": ["shopping"]}
city_centre_modifiers: ["shopping"]
city_centre_fit_level: good | moderate | poor
motivation_fit_level: good | moderate | poor

detected_motivations should include shopping-related entries like:
[
  {
    "motivation": "shopping-pause / hvile",
    "confidence": 0.7-0.9,
    "evidence": "Outdoor seating, central location near Salling/Magasin"
  },
  {
    "motivation": "post-shopping måltid",
    "confidence": 0.7-0.9,
    "evidence": "Full menu, wine list, close to major shopping"
  }
]
*/


-- ============================================================================
-- DEBUGGING QUERIES
-- ============================================================================

-- Check if category_modifiers column exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
  AND column_name = 'category_modifiers';


-- Check PostgREST schema cache status
SELECT pg_notify('pgrst', 'reload schema');


-- Manual refresh for Café Faust (if needed)
-- NOTE: Run via Edge Function, not SQL
/*
POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence
Authorization: Bearer <anon_key>
Content-Type: application/json

{
  "business_id": "f4679fa9-3120-4a59-9506-d059b010c34a",
  "force_refresh": true
}
*/
