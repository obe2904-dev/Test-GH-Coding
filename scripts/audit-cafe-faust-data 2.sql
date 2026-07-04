-- ============================================================
-- CAFÉ FAUST — COMPLETE DATA AUDIT
-- Purpose: Show exactly what data is available per field for
-- the live test business. Run in Supabase SQL Editor.
-- Business ID: 2037d63c-a138-4247-89c5-5b6b8cef9f3f
-- ============================================================

DO $$ BEGIN RAISE NOTICE 'Starting Café Faust data audit...'; END $$;

-- ============================================================
-- 1. CORE BUSINESS RECORD
-- ============================================================
SELECT
  '--- businesses ---' AS section,
  name,
  vertical,
  category,
  subscription_tier,
  plan,
  website_url,
  primary_language,
  CASE WHEN logo_url IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS logo_url,
  CASE WHEN subpage_urls IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS subpage_urls
FROM businesses
WHERE id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 2. BUSINESS PROFILE (business_profile table)
-- ============================================================
SELECT
  '--- business_profile ---' AS section,
  CASE WHEN short_description IS NOT NULL AND short_description != '' THEN '✅ set' ELSE '❌ null/empty' END AS short_description,
  CASE WHEN long_description IS NOT NULL AND long_description != '' THEN '✅ set' ELSE '❌ null/empty' END AS long_description,
  CASE WHEN menu_description IS NOT NULL AND menu_description != '' THEN '✅ set' ELSE '❌ null/empty' END AS menu_description,
  CASE WHEN menu_structure IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS menu_structure,
  CASE WHEN ai_brand_context IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS ai_brand_context,
  CASE WHEN ai_brand_context_approved IS TRUE THEN '✅ approved' ELSE '⚠️ not approved' END AS ai_brand_context_approved,
  CASE WHEN detected_menu_urls IS NOT NULL AND array_length(detected_menu_urls, 1) > 0 THEN '✅ ' || array_length(detected_menu_urls, 1)::text || ' url(s)' ELSE '❌ null/empty' END AS detected_menu_urls,
  CASE WHEN founded_year IS NOT NULL THEN '✅ ' || founded_year::text ELSE '❌ null' END AS founded_year
FROM business_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 3. BUSINESS OPERATIONS
-- ============================================================
-- NOTE: currency and average_check_per_person were dropped in migration
-- 20260420000008_drop_operations_derived_columns.sql (April 2026).
-- Currency is derived from country config; price_level covers the AI signal.
SELECT
  '--- business_operations ---' AS section,
  CASE WHEN price_level IS NOT NULL THEN '✅ ' || price_level ELSE '❌ null' END AS price_level,
  has_table_service,
  has_takeaway,
  has_delivery,
  has_wifi,
  has_parking,
  has_kids_menu,
  has_outdoor_seating,
  CASE WHEN kitchen_close_time IS NOT NULL THEN '✅ ' || kitchen_close_time::text ELSE '❌ null' END AS kitchen_close_time,
  CASE WHEN weekly_programme IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS weekly_programme,
  CASE WHEN establishment_type IS NOT NULL THEN '✅ ' || establishment_type ELSE '❌ null' END AS establishment_type,
  CASE WHEN preferred_posts_per_week IS NOT NULL THEN '✅ ' || preferred_posts_per_week::text ELSE '❌ null' END AS preferred_posts_per_week
FROM business_operations
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 4. OPENING HOURS (summary — are all days populated?)
-- ============================================================
SELECT
  '--- opening_hours ---' AS section,
  weekday,
  kind,
  open_time,
  close_time,
  closed
FROM opening_hours
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY CASE weekday
  WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
  WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
  WHEN 'sunday' THEN 7 END;

-- ============================================================
-- 5. BRAND PROFILE — AI-USED FIELDS
-- ============================================================
SELECT
  '--- business_brand_profile (used fields) ---' AS section,
  CASE WHEN business_character IS NOT NULL AND business_character != '' THEN '✅ ' || LEFT(business_character, 80) ELSE '❌ null/empty' END AS business_character,
  CASE WHEN visual_character IS NOT NULL AND visual_character != '' THEN '✅ ' || LEFT(visual_character, 80) ELSE '❌ null/empty' END AS visual_character,
  CASE WHEN venue_scene IS NOT NULL AND venue_scene != '' THEN '✅ ' || LEFT(venue_scene, 80) ELSE '❌ null/empty' END AS venue_scene,
  CASE WHEN venue_energy IS NOT NULL AND venue_energy != '' THEN '✅ ' || LEFT(venue_energy, 60) ELSE '❌ null/empty' END AS venue_energy,
  CASE WHEN tone_model IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS tone_model,
  CASE WHEN tone_of_voice IS NOT NULL AND tone_of_voice != '' THEN '✅ set' ELSE '❌ null/empty' END AS tone_of_voice,
  CASE WHEN voice_rationale IS NOT NULL AND voice_rationale != '' THEN '✅ set' ELSE '❌ null/empty' END AS voice_rationale,
  CASE WHEN content_strategy IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS content_strategy,
  CASE WHEN content_strategy_confirmed IS TRUE THEN '✅ confirmed' ELSE '⚠️ not confirmed' END AS content_strategy_confirmed,
  CASE WHEN things_to_avoid IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS things_to_avoid,
  CASE WHEN identity_keywords IS NOT NULL AND cardinality(identity_keywords) > 0 THEN '✅ set' ELSE '❌ null/empty' END AS identity_keywords,
  CASE WHEN communication_goal IS NOT NULL AND communication_goal != '' THEN '✅ ' || LEFT(communication_goal, 60) ELSE '❌ null/empty' END AS communication_goal,
  CASE WHEN target_audience IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS target_audience,
  CASE WHEN booking_link IS NOT NULL AND booking_link != '' THEN '✅ set' ELSE '❌ null/empty' END AS booking_link,
  CASE WHEN brand_essence IS NOT NULL AND brand_essence != '' THEN '✅ ' || LEFT(brand_essence, 80) ELSE '❌ null/empty' END AS brand_essence,
  CASE WHEN brand_essence_elaboration IS NOT NULL AND brand_essence_elaboration != '' THEN '✅ set' ELSE '❌ null/empty' END AS brand_essence_elaboration,
  CASE WHEN signature_phrases IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS signature_phrases,
  CASE WHEN voice_constraints IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS voice_constraints,
  CASE WHEN never_say IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS never_say,
  CASE WHEN typical_openings IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS typical_openings,
  CASE WHEN typical_closings IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS typical_closings,
  CASE WHEN posting_occasions IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS posting_occasions,
  CASE WHEN emotional_promise IS NOT NULL AND emotional_promise != '' THEN '✅ set' ELSE '❌ null/empty' END AS emotional_promise,
  CASE WHEN content_exclusions IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS content_exclusions,
  CASE WHEN what_makes_us_different IS NOT NULL AND what_makes_us_different != '' THEN '✅ set' ELSE '❌ null/empty' END AS what_makes_us_different,
  CASE WHEN humor_level IS NOT NULL THEN '✅ ' || humor_level::text ELSE '❌ null' END AS humor_level,
  CASE WHEN recognizable_interior_identity IS NOT NULL AND recognizable_interior_identity != '' THEN '✅ ' || LEFT(recognizable_interior_identity, 80) ELSE '❌ null/empty' END AS recognizable_interior_identity,
  CASE WHEN voice_examples IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS voice_examples,
  CASE WHEN location_intelligence IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS location_intelligence,
  CASE WHEN brand_context IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS brand_context
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 6. BRAND PROFILE — FIELDS NOT FED INTO AI (noise check)
-- ============================================================
SELECT
  '--- business_brand_profile (unused/noise fields) ---' AS section,
  CASE WHEN values IS NOT NULL THEN '⚠️ populated (not used in AI)' ELSE '✅ null' END AS values_field,
  CASE WHEN certifications IS NOT NULL THEN '⚠️ populated (not used in AI)' ELSE '✅ null' END AS certifications,
  CASE WHEN image_preferences IS NOT NULL THEN '⚠️ populated (not used in AI)' ELSE '✅ null' END AS image_preferences,
  CASE WHEN owner_document IS NOT NULL AND owner_document != 'null'::jsonb THEN '⚠️ populated (not used in AI)' ELSE '✅ null' END AS owner_document,
  CASE WHEN do_not_say IS NOT NULL THEN '⚠️ partially used' ELSE '✅ null' END AS do_not_say,
  CASE WHEN social_style IS NOT NULL THEN '⚠️ populated (not used in AI)' ELSE '✅ null' END AS social_style,
  CASE WHEN tone_keywords IS NOT NULL THEN '⚠️ fallback only' ELSE '✅ null' END AS tone_keywords,
  CASE WHEN sample_posts IS NOT NULL THEN '⚠️ read but not injected' ELSE '✅ null' END AS sample_posts,
  CASE WHEN core_offerings IS NOT NULL THEN '⚠️ read but not confirmed in prompt' ELSE '✅ null' END AS core_offerings,
  CASE WHEN content_focus IS NOT NULL THEN '⚠️ overridden by content_strategy' ELSE '✅ null' END AS content_focus,
  CASE WHEN quality_status IS NOT NULL THEN '📊 ' || quality_status ELSE '❌ null' END AS quality_status
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 7. LOCATION
-- ============================================================
SELECT
  '--- business_locations ---' AS section,
  city,
  postal_code,
  country,
  CASE WHEN address_line1 IS NOT NULL AND address_line1 != '' THEN '✅ set' ELSE '❌ null/empty' END AS address_line1,
  CASE WHEN phone IS NOT NULL AND phone != '' THEN '✅ set' ELSE '❌ null/empty' END AS phone,
  CASE WHEN email IS NOT NULL AND email != '' THEN '✅ set' ELSE '❌ null/empty' END AS email,
  CASE WHEN maps_url IS NOT NULL AND maps_url != '' THEN '✅ set' ELSE '❌ null/empty' END AS maps_url
FROM business_locations
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 8. LOCATION INTELLIGENCE
-- ============================================================
SELECT
  '--- business_location_intelligence ---' AS section,
  CASE WHEN neighborhood IS NOT NULL AND neighborhood != '' THEN '✅ ' || neighborhood ELSE '❌ null/empty' END AS neighborhood,
  CASE WHEN area_type IS NOT NULL AND area_type != '' THEN '✅ ' || area_type ELSE '❌ null/empty' END AS area_type,
  CASE WHEN location_marketing_hooks IS NOT NULL AND cardinality(location_marketing_hooks) > 0 THEN '✅ set' ELSE '❌ null/empty' END AS location_marketing_hooks,
  CASE WHEN landmarks_nearby IS NOT NULL THEN '⚠️ populated (not yet used in AI): ' || LEFT(landmarks_nearby::text, 60) ELSE '✅ null' END AS landmarks_nearby,
  CASE WHEN neighborhood_character IS NOT NULL AND neighborhood_character != '' THEN '⚠️ ' || neighborhood_character ELSE '✅ null' END AS neighborhood_character,
  CASE WHEN has_view IS NOT NULL THEN '⚠️ ' || has_view::text ELSE '✅ null' END AS has_view,
  CASE WHEN is_hidden_gem IS NOT NULL THEN '⚠️ ' || is_hidden_gem::text ELSE '✅ null' END AS is_hidden_gem,
  CASE WHEN when_analysis IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS when_analysis,
  CASE WHEN who_analysis IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS who_analysis,
  CASE WHEN why_analysis IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS why_analysis,
  CASE WHEN concept_fit_by_category IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS concept_fit_by_category,
  CASE WHEN latitude IS NOT NULL THEN '✅ weather param' ELSE '❌ null' END AS latitude,
  CASE WHEN longitude IS NOT NULL THEN '✅ weather param' ELSE '❌ null' END AS longitude
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 9. MENUS — How many and what type?
-- ============================================================
SELECT
  '--- menu_results_v2 ---' AS section,
  id,
  status,
  extraction_method,
  service_period_name,
  CASE WHEN ai_summary IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS ai_summary,
  CASE WHEN structured_data IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS structured_data,
  CASE WHEN source_url IS NOT NULL THEN '✅ ' || LEFT(source_url, 80) ELSE '❌ null' END AS source_url,
  created_at
FROM menu_results_v2
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY created_at DESC;

-- ============================================================
-- 10. MENU ITEMS — Count per menu
-- ============================================================
SELECT
  '--- menu_items_normalized (counts) ---' AS section,
  menu_result_id,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE is_signature = true) AS signature_count,
  COUNT(*) FILTER (WHERE is_seasonal = true) AS seasonal_count,
  COUNT(*) FILTER (WHERE is_limited_time = true) AS limited_time_count
FROM menu_items_normalized
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
GROUP BY menu_result_id;

-- ============================================================
-- 11. VISUAL IDENTITY
-- NOTE: business_visual_identity table was DROPPED April 2026
-- (migration 20260420000007). Visual style data is now stored
-- in business_brand_profile (visual_character, venue_scene).
-- ============================================================
-- (No query — table does not exist)

-- ============================================================
-- 12. CONCEPT FIT (from business_location_intelligence)
-- NOTE: business_concept_fit table was dropped. Concept fit
-- data is now stored in business_location_intelligence.
-- ============================================================
SELECT
  '--- concept fit (via business_location_intelligence) ---' AS section,
  CASE WHEN concept_fit_by_category IS NOT NULL THEN '✅ ' || LEFT(concept_fit_by_category::text, 120) ELSE '❌ null' END AS concept_fit_by_category,
  CASE WHEN concept_fit_analyzed_at IS NOT NULL THEN '✅ analyzed at ' || concept_fit_analyzed_at::text ELSE '❌ never analyzed' END AS concept_fit_analyzed_at
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ============================================================
-- 13. RECENT DAILY SUGGESTIONS (last 5 — what did AI receive?)
-- ============================================================
SELECT
  '--- daily_suggestions (last 5) ---' AS section,
  id,
  date,
  position,
  content_type,
  LEFT(title, 100) AS title,
  LEFT(rationale, 100) AS rationale,
  is_active,
  selected,
  created_at
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- 14. WEEKLY STRATEGIES (is there a current one?)
-- ============================================================
SELECT
  '--- weekly_strategies (latest) ---' AS section,
  id,
  status,
  week_start,
  week_end,
  week_number,
  is_current_week,
  CASE WHEN narrative IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS narrative,
  CASE WHEN post_ideas IS NOT NULL THEN '✅ set' ELSE '❌ null' END AS post_ideas,
  CASE WHEN selected_idea_ids IS NOT NULL THEN '✅ ' || cardinality(selected_idea_ids)::text || ' selected' ELSE '❌ null' END AS selected_idea_ids,
  generated_at
FROM weekly_strategies
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY generated_at DESC
LIMIT 3;

DO $$ BEGIN RAISE NOTICE 'Audit complete.'; END $$;
