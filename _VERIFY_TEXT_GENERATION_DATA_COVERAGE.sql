-- Verify Data Coverage for Text Generation (80+ Fields)
-- Test Business: Restaurant Valdemar
-- Business ID: 69c4a56b-5317-41ad-86a0-b2237393fbd1

-- ============================================================================
-- PART 1: BRAND PROFILE DATA COVERAGE (business_brand_profile - 73 fields)
-- ============================================================================

-- Dynamic field coverage check
WITH brand_profile_data AS (
  SELECT * FROM business_brand_profile
  WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1'
),
field_checks AS (
  SELECT
    -- Count ALL non-null critical fields
    (CASE WHEN tone_of_voice IS NOT NULL AND tone_of_voice != '' THEN 1 ELSE 0 END +
     CASE WHEN tone_model IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN tone_keywords IS NOT NULL AND jsonb_array_length(tone_keywords) > 0 THEN 1 ELSE 0 END +
     CASE WHEN typical_openings IS NOT NULL AND jsonb_array_length(typical_openings) > 0 THEN 1 ELSE 0 END +
     CASE WHEN things_to_avoid IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN voice_constraints IS NOT NULL AND voice_constraints != '' THEN 1 ELSE 0 END +
     CASE WHEN voice_rationale IS NOT NULL AND voice_rationale != '' THEN 1 ELSE 0 END +
     CASE WHEN target_audience IS NOT NULL AND target_audience != '' THEN 1 ELSE 0 END +
     CASE WHEN communication_goal IS NOT NULL AND communication_goal != '' THEN 1 ELSE 0 END +
     CASE WHEN emotional_promise IS NOT NULL AND emotional_promise != '' THEN 1 ELSE 0 END +
     CASE WHEN strategic_audience_segments IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN brand_context IS NOT NULL AND brand_context != '' THEN 1 ELSE 0 END +
     CASE WHEN business_character IS NOT NULL AND business_character != '' THEN 1 ELSE 0 END +
     CASE WHEN recognizable_interior_identity IS NOT NULL AND recognizable_interior_identity != '' THEN 1 ELSE 0 END +
     CASE WHEN visual_character IS NOT NULL AND visual_character != '' THEN 1 ELSE 0 END +
     CASE WHEN venue_scene IS NOT NULL AND venue_scene != '' THEN 1 ELSE 0 END +
     CASE WHEN humor_level IS NOT NULL AND humor_level != '' THEN 1 ELSE 0 END +
     CASE WHEN menu_overview_summary IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN gastronomic_profile IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN signature_themes IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN marketing_manager_brief IS NOT NULL AND marketing_manager_brief != '' THEN 1 ELSE 0 END +
     CASE WHEN content_strategy IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN brand_essence IS NOT NULL AND brand_essence != '' THEN 1 ELSE 0 END +
     CASE WHEN core_offerings IS NOT NULL AND core_offerings != '' THEN 1 ELSE 0 END +
     CASE WHEN content_focus IS NOT NULL AND content_focus != '' THEN 1 ELSE 0 END +
     CASE WHEN content_pillars IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN cta_style IS NOT NULL AND cta_style != '' THEN 1 ELSE 0 END +
     CASE WHEN image_preferences IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN social_style IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN voice_examples IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN brand_essence_elaboration IS NOT NULL AND brand_essence_elaboration != '' THEN 1 ELSE 0 END +
     CASE WHEN identity_keywords IS NOT NULL THEN 1 ELSE 0 END) as populated_fields,
    
    32 as total_fields
  FROM brand_profile_data
)
SELECT 
  'BRAND PROFILE COVERAGE' as metric,
  populated_fields || '/' || total_fields as coverage,
  ROUND((populated_fields::numeric / total_fields::numeric) * 100, 1) || '%' as percentage,
  CASE 
    WHEN populated_fields::numeric / total_fields::numeric >= 0.7 THEN '✅ GOOD'
    WHEN populated_fields::numeric / total_fields::numeric >= 0.5 THEN '⚠️ PARTIAL'
    ELSE '❌ POOR'
  END as status
FROM field_checks;

-- ============================================================================
-- PART 1B: CRITICAL BRAND PROFILE FIELDS (Individual Check)
-- ============================================================================

SELECT 
  'CRITICAL FIELDS' as category,
  
  -- V5.8 & Core Voice
  CASE WHEN marketing_manager_brief IS NOT NULL AND marketing_manager_brief != '' THEN '✅' ELSE '❌' END as marketing_manager_brief,
  CASE WHEN tone_model IS NOT NULL THEN '✅' ELSE '❌' END as tone_model,
  CASE WHEN tone_of_voice IS NOT NULL AND tone_of_voice != '' THEN '✅' ELSE '❌' END as tone_of_voice,
  CASE WHEN business_character IS NOT NULL AND business_character != '' THEN '✅' ELSE '❌' END as business_character,
  
  -- Content Strategy (JSONB)
  CASE WHEN content_strategy IS NOT NULL THEN '✅' ELSE '❌' END as content_strategy,
  
  -- Audience & Goals
  CASE WHEN target_audience IS NOT NULL AND target_audience != '' THEN '✅' ELSE '❌' END as target_audience,
  CASE WHEN communication_goal IS NOT NULL AND communication_goal != '' THEN '✅' ELSE '❌' END as communication_goal,
  
  -- Menu Context (JSONB fields - check for NULL only)
  CASE WHEN menu_overview_summary IS NOT NULL THEN '✅' ELSE '❌' END as menu_overview_summary,
  CASE WHEN gastronomic_profile IS NOT NULL THEN '✅' ELSE '❌' END as gastronomic_profile

FROM business_brand_profile
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 2: BUSINESS PROFILE DATA (business_profile)
-- ============================================================================

SELECT 
  'BUSINESS PROFILE' as source_table,
  
  CASE WHEN long_description IS NOT NULL AND long_description != '' THEN '✅' ELSE '❌' END as long_description,
  CASE WHEN booking_url IS NOT NULL AND booking_url != '' THEN '✅' ELSE '❌' END as booking_url

FROM business_profile
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 3: LOCATION INTELLIGENCE (business_location_intelligence)
-- ============================================================================

SELECT 
  'LOCATION INTELLIGENCE' as source_table,
  
  CASE WHEN neighborhood IS NOT NULL AND neighborhood != '' THEN '✅' ELSE '❌' END as neighborhood,
  CASE WHEN neighborhood_character IS NOT NULL AND neighborhood_character != '' THEN '✅' ELSE '❌' END as neighborhood_character,
  CASE WHEN area_type IS NOT NULL AND area_type != '' THEN '✅' ELSE '❌' END as area_type,
  CASE WHEN category_scores IS NOT NULL THEN '✅' ELSE '❌' END as category_scores,
  CASE WHEN demographic_proximity IS NOT NULL THEN '✅' ELSE '❌' END as demographic_proximity,
  CASE WHEN who IS NOT NULL AND who != '' THEN '✅' ELSE '❌' END as who_nearby,
  CASE WHEN traffic_rhythm IS NOT NULL AND traffic_rhythm != '' THEN '✅' ELSE '❌' END as traffic_rhythm,
  CASE WHEN physical_context IS NOT NULL THEN '✅' ELSE '❌' END as physical_context,
  CASE WHEN raw_competitive_venues IS NOT NULL THEN '✅' ELSE '❌' END as raw_competitive_venues,
  CASE WHEN landmarks_nearby IS NOT NULL AND jsonb_array_length(landmarks_nearby) > 0 THEN '✅' ELSE '❌' END as landmarks_nearby,
  CASE WHEN nearby_hospitality IS NOT NULL THEN '✅' ELSE '❌' END as nearby_hospitality,
  CASE WHEN category_modifiers IS NOT NULL THEN '✅' ELSE '❌' END as category_modifiers,
  CASE WHEN location_marketing_hooks IS NOT NULL AND jsonb_array_length(location_marketing_hooks) > 0 THEN '✅' ELSE '❌' END as location_marketing_hooks,
  CASE WHEN local_location_reference IS NOT NULL AND local_location_reference != '' THEN '✅' ELSE '❌' END as local_location_reference

FROM business_location_intelligence
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 4: BUSINESS OPERATIONS (business_operations)
-- ============================================================================

SELECT 
  'BUSINESS OPERATIONS' as source_table,
  
  CASE WHEN reservation_required IS NOT NULL THEN '✅' ELSE '❌' END as reservation_required,
  CASE WHEN accepts_walkins IS NOT NULL THEN '✅' ELSE '❌' END as accepts_walkins,
  CASE WHEN has_outdoor_seating IS NOT NULL THEN '✅' ELSE '❌' END as has_outdoor_seating,
  CASE WHEN cuisine_type IS NOT NULL AND cuisine_type != '' THEN '✅' ELSE '❌' END as cuisine_type,
  CASE WHEN price_level IS NOT NULL AND price_level != '' THEN '✅' ELSE '❌' END as price_level

FROM business_operations
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 5: OPENING HOURS
-- ============================================================================

SELECT 
  'OPENING HOURS' as source_table,
  COUNT(*) as days_configured,
  CASE WHEN COUNT(*) >= 7 THEN '✅' ELSE '⚠️' END as status
FROM opening_hours
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 6: MENU DATA (menu_results_v2)
-- ============================================================================

SELECT 
  'MENU RESULTS' as source_table,
  COUNT(*) as total_menus,
  COUNT(DISTINCT service_period_name) as service_periods_count,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as has_menus,
  
  -- Check for AI summaries
  COUNT(CASE WHEN ai_summary IS NOT NULL AND ai_summary != '' THEN 1 END) as menus_with_ai_summary,
  CASE WHEN COUNT(CASE WHEN ai_summary IS NOT NULL AND ai_summary != '' THEN 1 END) > 0 THEN '✅' ELSE '❌' END as has_ai_summaries,
  
  -- Check for representative dishes
  COUNT(CASE WHEN representative_dishes IS NOT NULL THEN 1 END) as menus_with_dishes,
  CASE WHEN COUNT(CASE WHEN representative_dishes IS NOT NULL THEN 1 END) > 0 THEN '✅' ELSE '❌' END as has_representative_dishes

FROM menu_results_v2
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1'
  AND status = 'done';

-- ============================================================================
-- PART 7: USER PROFILE (V5.8 - selected_platforms)
-- ============================================================================

SELECT 
  'USER PROFILE' as source_table,
  
  CASE WHEN p.selected_platforms IS NOT NULL THEN '✅' ELSE '❌' END as selected_platforms,
  p.selected_platforms as platform_data

FROM businesses b
LEFT JOIN profiles p ON p.id = b.owner_id
WHERE b.id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';

-- ============================================================================
-- PART 8: COMPREHENSIVE FIELD COUNT SUMMARY (ALL TABLES)
-- ============================================================================

-- This uses dynamic queries to count ALL non-null fields across all tables
SELECT 
  'brand_profile' as category,
  COUNT(*) FILTER (WHERE column_name NOT IN ('id', 'business_id', 'created_at', 'updated_at')) as total_fields,
  '73 fields per schema' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'

UNION ALL

SELECT 
  'location_intelligence' as category,
  COUNT(*) FILTER (WHERE column_name NOT IN ('id', 'business_id', 'created_at', 'updated_at')) as total_fields,
  'Geographic + demographic context' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_location_intelligence'

UNION ALL

SELECT 
  'business_operations' as category,
  COUNT(*) FILTER (WHERE column_name NOT IN ('id', 'business_id', 'created_at', 'updated_at')) as total_fields,
  'Operational settings' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_operations'

UNION ALL

SELECT 
  'business_profile' as category,
  COUNT(*) FILTER (WHERE column_name NOT IN ('id', 'business_id', 'created_at', 'updated_at')) as total_fields,
  'Long description + booking' as note
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_profile';

-- ============================================================================
-- PART 9: NULL FIELD ANALYSIS (Top Missing Fields)
-- ============================================================================

WITH brand_profile_nulls AS (
  SELECT 
    business_id,
    CASE WHEN marketing_manager_brief IS NULL OR marketing_manager_brief = '' THEN 1 ELSE 0 END as missing_marketing_brief,
    CASE WHEN tone_model IS NULL THEN 1 ELSE 0 END as missing_tone_model,
    CASE WHEN business_character IS NULL OR business_character = '' THEN 1 ELSE 0 END as missing_business_character,
    CASE WHEN content_strategy IS NULL THEN 1 ELSE 0 END as missing_content_strategy,
    CASE WHEN voice_constraints IS NULL OR voice_constraints = '' THEN 1 ELSE 0 END as missing_voice_constraints,
    CASE WHEN menu_overview_summary IS NULL THEN 1 ELSE 0 END as missing_menu_summary,
    CASE WHEN gastronomic_profile IS NULL THEN 1 ELSE 0 END as missing_gastro_profile,
    CASE WHEN recognizable_interior_identity IS NULL OR recognizable_interior_identity = '' THEN 1 ELSE 0 END as missing_interior_identity,
    CASE WHEN venue_scene IS NULL OR venue_scene = '' THEN 1 ELSE 0 END as missing_venue_scene,
    CASE WHEN humor_level IS NULL OR humor_level = '' THEN 1 ELSE 0 END as missing_humor
  FROM business_brand_profile
  WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1'
)
SELECT 
  '🔍 CRITICAL MISSING FIELDS' as report,
  CASE WHEN missing_marketing_brief = 1 THEN '❌ marketing_manager_brief' ELSE '✅ marketing_manager_brief' END as v58_brief,
  CASE WHEN missing_tone_model = 1 THEN '❌ tone_model' ELSE '✅ tone_model' END as tone_model,
  CASE WHEN missing_business_character = 1 THEN '❌ business_character' ELSE '✅ business_character' END as business_char,
  CASE WHEN missing_content_strategy = 1 THEN '❌ content_strategy' ELSE '✅ content_strategy' END as content_strat,
  CASE WHEN missing_menu_summary = 1 THEN '❌ menu_overview_summary' ELSE '✅ menu_overview_summary' END as menu_summary
FROM brand_profile_nulls;

-- ============================================================================
-- PART 10: ACTUAL DATA SAMPLES (Verify Content Quality)
-- ============================================================================

-- Show first 200 chars of critical text fields to verify they're not just populated but meaningful
SELECT 
  'DATA SAMPLES' as section,
  LEFT(marketing_manager_brief, 200) || '...' as marketing_brief_sample,
  LEFT(business_character, 100) as business_character_sample,
  LEFT(menu_overview_summary::text, 150) || '...' as menu_summary_sample
FROM business_brand_profile
WHERE business_id = '69c4a56b-5317-41ad-86a0-b2237393fbd1';
