-- COMPREHENSIVE BRAND PROFILE DIAGNOSTIC
-- Shows complete state after all fixes
-- Run in Supabase SQL Editor

SELECT 
  '=== BASIC INFO ===' as section,
  b.name as data1,
  b.id::text as data2
FROM businesses b
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Layer 0: Business Intelligence - RAW JSON
SELECT 
  '=== LAYER 0: BUSINESS TYPE (RAW JSON) ===' as section,
  (bbp.brand_profile_v5->'layer_0_intelligence'->'business_type')::text as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Layer 0: Business Intelligence
SELECT 
  '=== LAYER 0: BUSINESS INTELLIGENCE ===' as section,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as data1,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_type'->>'professional_domain' as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Programmes from database
SELECT 
  '=== PROGRAMMES (from business_programme_profiles) ===' as section,
  jsonb_agg(
    jsonb_build_object(
      'type', bpp.programme_type,
      'name', bpp.programme_name,
      'time_windows', bpp.time_windows,
      'days', bpp.operating_days
    ) ORDER BY bpp.programme_type
  )::text as data1,
  NULL::text as data2
FROM business_programme_profiles bpp
WHERE bpp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Programmes in V5 profile
SELECT 
  '=== PROGRAMMES (in brand_profile_v5.programmes) ===' as section,
  (bbp.brand_profile_v5->'programmes')::text as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Voice archetype - RAW JSON
SELECT 
  '=== LAYER 5: VOICE (RAW JSON) ===' as section,
  (bbp.brand_profile_v5->'voice')::text as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Voice archetype (from reasoning field)
SELECT 
  '=== LAYER 5: VOICE ARCHETYPE ===' as section,
  substring(bbp.brand_profile_v5->'voice'->>'voice_reasoning' from 'Voice archetype: ([^\n]+)') as data1,
  bbp.brand_profile_v5->'voice'->>'voice_confidence' as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Voice tone rules
SELECT 
  '=== VOICE TONE RULES ===' as section,
  jsonb_array_length(bbp.brand_profile_v5->'voice'->'tone_rules')::text || ' rules' as data1,
  (bbp.brand_profile_v5->'voice'->'tone_rules')::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Voice content anchors & personality
SELECT 
  '=== VOICE ANCHORS & PERSONALITY ===' as section,
  (bbp.brand_profile_v5->'voice'->'content_anchors')::text as data1,
  (bbp.brand_profile_v5->'voice'->'personality_traits')::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Identity: Brand Essence
SELECT 
  '=== LAYER 3: IDENTITY - BRAND ESSENCE ===' as section,
  bbp.brand_profile_v5->'identity'->>'brand_essence' as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Menu Intelligence
SELECT 
  '=== MENU INTELLIGENCE ===' as section,
  jsonb_build_object(
    'signature_themes', bbp.signature_themes,
    'gastronomic_profile', bbp.gastronomic_profile,
    'menu_overview_summary', bbp.menu_overview_summary
  )::text as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Menu extractions status
SELECT 
  '=== MENU EXTRACTIONS (menu_results_v2) ===' as section,
  jsonb_agg(
    jsonb_build_object(
      'source_url', mr.source_url,
      'status', mr.status,
      'menuTitle', mr.structured_data->'menuTitle',
      'item_count', (
        SELECT COUNT(*)
        FROM jsonb_array_elements(mr.structured_data->'categories') as cat,
             jsonb_array_elements(cat->'items') as item
      ),
      'completed_at', mr.completed_at
    )
  )::text as data1,
  NULL::text as data2
FROM menu_results_v2 mr
WHERE mr.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND mr.status = 'done'

UNION ALL

-- Persona
SELECT 
  '=== PERSONA (Layer 0) ===' as section,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as data1,
  NULL::text as data2
FROM business_brand_profile bbp
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Location Intelligence: Category Scores (all detected types)
SELECT 
  '=== LOCATION: CATEGORY SCORES (all detected) ===' as section,
  jsonb_pretty(bli.category_scores) as data1,
  NULL::text as data2
FROM business_location_intelligence bli
WHERE bli.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Location Intelligence: Displayed Categories (score >= 60)
SELECT 
  '=== LOCATION: DISPLAYED CATEGORIES (score >= 60) ===' as section,
  jsonb_pretty(
    jsonb_object_agg(
      key, 
      value
    )
  ) as data1,
  COUNT(*)::text || ' categories shown' as data2
FROM business_location_intelligence bli,
     jsonb_each(bli.category_scores)
WHERE bli.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (value::text::int) >= 60
GROUP BY bli.business_id

UNION ALL

-- Location Intelligence: Concept Fit (marketing implications)
SELECT 
  '=== LOCATION: CONCEPT FIT BY CATEGORY ===' as section,
  key as data1,
  jsonb_pretty(value->'marketing_implications'->'content_emphasis') as data2
FROM business_location_intelligence bli,
     jsonb_each(bli.concept_fit_by_category)
WHERE bli.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND value->>'fit_level' != 'challenging'

UNION ALL

-- Location Intelligence: Neighborhood Character
SELECT 
  '=== LOCATION: NEIGHBORHOOD CHARACTER ===' as section,
  bli.neighborhood_character as data1,
  bli.area_type as data2
FROM business_location_intelligence bli
WHERE bli.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
