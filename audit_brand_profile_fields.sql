-- Brand profile V5 field audit
-- Step 1: dead/unused fields in the V5 prompt flow
-- Step 2: active fields for a single business_id with data-completeness and AI-readiness hints

WITH active_fields AS (
  SELECT * FROM (VALUES
    ('businesses', 'id', 'active', 'Business primary key'),
    ('businesses', 'name', 'active', 'Business name'),
    ('businesses', 'category', 'active', 'Business category used by V5 prompts'),
    ('businesses', 'vertical', 'active', 'Legacy business type fallback'),
    ('businesses', 'country', 'active', 'Language fallback + city context'),
    ('businesses', 'primary_language', 'active', 'Resolved language input'),
    ('businesses', 'address', 'active', 'Address used in persona prompt'),
    ('businesses', 'local_location_reference', 'active', 'Exact local place reference'),
    ('business_locations', 'postal_code', 'active', 'Postal code for city inference'),
    ('business_locations', 'city', 'active', 'Primary location city'),
    ('business_locations', 'address_line1', 'active', 'Address fallback'),
    ('business_profile', 'long_description', 'active', 'AI-facing business summary for the current V5 prompt chain'),
    ('business_profile', 'user_about_text', 'inactive', 'UI-only editable about text; not used by the V5 prompt chain'),
    ('business_profile', 'ai_place_synopsis', 'inactive', 'New synopsis field, not yet wired into V5'),
    ('business_profile', 'short_description', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'menu_description', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'menu_signal', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'menu_structure', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'founded_year', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'detected_menu_urls', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'ai_brand_context', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'ai_brand_context_approved', 'inactive', 'Not used by current V5 generator'),
    ('business_profile', 'ai_brand_context_generated_at', 'inactive', 'Not used by current V5 generator'),
    ('business_operations', 'establishment_type', 'active', 'Used in business type detection'),
    ('business_operations', 'reservation_required', 'active', 'Used in commercial orientation'),
    ('business_operations', 'accepts_walk_ins', 'active', 'Used in commercial orientation'),
    ('business_operations', 'accepts_walkins', 'active', 'Used in commercial orientation'),
    ('business_operations', 'has_outdoor_seating', 'active', 'Used in voice/guardrails'),
    ('business_operations', 'has_takeaway', 'active', 'Used in persona/features'),
    ('business_operations', 'has_delivery', 'active', 'Used in persona/features'),
    ('business_operations', 'has_wifi', 'active', 'Used in persona/features'),
    ('business_operations', 'has_kids_menu', 'active', 'Used in persona/features'),
    ('business_operations', 'kitchen_close_time', 'active', 'Used in persona/voice'),
    ('business_operations', 'opening_hours', 'active', 'Used in persona and scheduling'),
    ('business_operations', 'price_level', 'active', 'Used in business profile context'),
    ('business_operations', 'primary_service_period', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('business_operations', 'weekly_programme', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('business_location_intelligence', 'area_type', 'active', 'Used in location and voice prompts'),
    ('business_location_intelligence', 'neighborhood', 'active', 'Used in location and audience prompts'),
    ('business_location_intelligence', 'neighborhood_character', 'active', 'Used in voice and persona prompts'),
    ('business_location_intelligence', 'category_scores', 'active', 'Used in persona and voice prompts'),
    ('business_location_intelligence', 'location_marketing_hooks', 'active', 'Used in persona prompt'),
    ('business_location_intelligence', 'local_location_reference', 'active', 'Source of truth for exact local location wording'),
    ('business_location_intelligence', 'nearby_hospitality', 'active', 'Used in commercial orientation'),
    ('business_location_intelligence', 'location_type_matches', 'active', 'Used in persona prompt'),
    ('business_location_intelligence', 'tourist_context', 'active', 'Used in audience prompt'),
    ('business_location_intelligence', 'landmarks', 'active', 'Used in audience prompt'),
    ('business_location_intelligence', 'landmarks_nearby', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('business_location_intelligence', 'street_visibility', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('business_location_intelligence', 'public_transport', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('menu_results_v2', 'ai_summary', 'active', 'Used in persona, audience, voice'),
    ('menu_results_v2', 'structured_data', 'active', 'Used in menu parsing'),
    ('menu_results_v2', 'service_periods', 'active', 'Used in persona and detection'),
    ('menu_results_v2', 'service_period_name', 'active', 'Used in persona and voice'),
    ('menu_results_v2', 'representative_dishes', 'active', 'Used in voice examples'),
    ('menu_results_v2', 'language_code', 'active', 'Used in language filtering'),
    ('menu_results_v2', 'source_url', 'active', 'Used in drinks filtering and traceability'),
    ('menu_results_v2', 'source_id', 'active', 'Used in join to menu_sources'),
    ('menu_results_v2', 'status', 'active', 'Used in query filter'),
    ('menu_results_v2', 'completed_at', 'active', 'Used for ordering'),
    ('menu_sources', 'label', 'active', 'Used in drinks filtering'),
    ('menu_sources', 'menu_type', 'active', 'Used in drinks filtering'),
    ('menu_sources', 'source_url', 'active', 'Traceability / source metadata'),
    ('opening_hours', 'weekday', 'active', 'Used in persona and audience prompts'),
    ('opening_hours', 'open_time', 'active', 'Used in persona and audience prompts'),
    ('opening_hours', 'close_time', 'active', 'Used in persona and audience prompts'),
    ('opening_hours', 'closed', 'inactive', 'Not directly consumed by current V5 prompt chain'),
    ('business_brand_profile', 'tone_model', 'active', 'Legacy voice hints'),
    ('business_brand_profile', 'voice_constraints', 'active', 'Legacy guardrail hints'),
    ('business_brand_profile', 'never_say', 'active', 'Legacy guardrail hints'),
    ('business_brand_profile', 'things_to_avoid', 'active', 'Legacy guardrail hints'),
    ('business_brand_profile', 'typical_openings', 'active', 'Writing examples fallback'),
    ('business_brand_profile', 'typical_closings', 'inactive', 'Not exposed in current live schema; remove from prompt mapping'),
    ('business_brand_profile', 'signature_phrases', 'active', 'Writing examples fallback'),
    ('business_brand_profile', 'menu_overview_summary', 'active', 'Persona + voice context'),
    ('business_brand_profile', 'gastronomic_profile', 'active', 'Persona context'),
    ('business_brand_profile', 'signature_themes', 'active', 'Persona + voice context'),
    ('business_brand_profile', 'business_character', 'active', 'Guardrails and persona context'),
    ('business_brand_profile', 'humor_level', 'active', 'Migrated to voice profile')
  ) AS v(table_name, column_name, usage_state, note)
),
schema_columns AS (
  SELECT
    table_schema,
    table_name,
    column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'businesses',
      'business_locations',
      'business_profile',
      'business_operations',
      'business_location_intelligence',
      'menu_results_v2',
      'menu_sources',
      'opening_hours',
      'business_brand_profile'
    )
)
SELECT
  s.table_name,
  s.column_name,
  COALESCE(a.usage_state, 'dead') AS usage_state,
  COALESCE(a.note, 'Not referenced in current V5 prompt flow') AS note
FROM schema_columns s
LEFT JOIN active_fields a
  ON a.table_name = s.table_name
 AND a.column_name = s.column_name
WHERE COALESCE(a.usage_state, 'dead') = 'dead'
ORDER BY s.table_name, s.column_name;

-- =========================================================
-- Active field quality check for one business_id
-- Replace the UUID below as needed.
-- =========================================================

WITH target AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
),
business_row AS (
  SELECT b.*
  FROM businesses b
  JOIN target t ON t.business_id = b.id
),
profile_row AS (
  SELECT bp.*
  FROM business_profile bp
  JOIN target t ON t.business_id = bp.business_id
),
operations_row AS (
  SELECT bo.*
  FROM business_operations bo
  JOIN target t ON t.business_id = bo.business_id
),
location_row AS (
  SELECT li.*
  FROM business_location_intelligence li
  JOIN target t ON t.business_id = li.business_id
),
menu_rollup AS (
  SELECT
    mr.business_id,
    jsonb_agg(mr.* ORDER BY mr.completed_at DESC) FILTER (WHERE mr.status = 'done') AS menu_results_v2
  FROM menu_results_v2 mr
  JOIN target t ON t.business_id = mr.business_id
  GROUP BY mr.business_id
)
SELECT * FROM (
  SELECT 'businesses.name' AS prompt_variable, 'businesses' AS source_table, 'name' AS source_column,
         br.name::text AS raw_value,
         CASE WHEN br.name IS NULL OR btrim(br.name) = '' THEN 'missing' ELSE 'present' END AS data_state,
         CASE WHEN br.name IS NULL OR btrim(br.name) = '' THEN 'n/a' ELSE 'good' END AS ai_readiness,
         'Short, direct, AI-ready' AS note
  FROM business_row br

  UNION ALL
  SELECT 'businesses.category', 'businesses', 'category', br.category::text,
         CASE WHEN br.category IS NULL OR btrim(br.category) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN br.category IS NULL OR btrim(br.category) = '' THEN 'n/a' ELSE 'good' END,
         'Used as business category in V5'
  FROM business_row br

  UNION ALL
  SELECT 'business_operations.establishment_type', 'business_operations', 'establishment_type', orow.establishment_type::text,
         CASE WHEN orow.establishment_type IS NULL OR btrim(orow.establishment_type) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN orow.establishment_type IS NULL OR btrim(orow.establishment_type) = '' THEN 'n/a' ELSE 'good' END,
         'Compact code, AI-friendly'
  FROM operations_row orow

  UNION ALL
  SELECT 'business_profile.long_description', 'business_profile', 'long_description', pr.long_description::text,
         CASE WHEN pr.long_description IS NULL OR btrim(pr.long_description) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN pr.long_description IS NULL OR btrim(pr.long_description) = '' THEN 'n/a' ELSE 'mixed' END,
         'Often verbose; may need trimming/splitting'
  FROM profile_row pr

  UNION ALL
  SELECT 'business_profile.user_about_text', 'business_profile', 'user_about_text', pr.user_about_text::text,
         CASE WHEN pr.user_about_text IS NULL OR btrim(pr.user_about_text) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN pr.user_about_text IS NULL OR btrim(pr.user_about_text) = '' THEN 'n/a' ELSE 'good' END,
         'User-facing editable about text'
  FROM profile_row pr

  UNION ALL
  SELECT 'business_profile.ai_place_synopsis', 'business_profile', 'ai_place_synopsis', pr.ai_place_synopsis::text,
         CASE WHEN pr.ai_place_synopsis IS NULL OR btrim(pr.ai_place_synopsis) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN pr.ai_place_synopsis IS NULL OR btrim(pr.ai_place_synopsis) = '' THEN 'n/a' ELSE 'good' END,
         'Compact factual synopsis is ideal for AI'
  FROM profile_row pr

  UNION ALL
  SELECT 'business_location_intelligence.neighborhood_character', 'business_location_intelligence', 'neighborhood_character', lr.neighborhood_character::text,
         CASE WHEN lr.neighborhood_character IS NULL OR btrim(lr.neighborhood_character) = '' THEN 'missing' ELSE 'present' END,
         CASE WHEN lr.neighborhood_character IS NULL OR btrim(lr.neighborhood_character) = '' THEN 'n/a' ELSE 'good' END,
         'Short context phrase is AI-friendly'
  FROM location_row lr

  UNION ALL
  SELECT 'menu_results_v2.ai_summary', 'menu_results_v2', 'ai_summary', (
    SELECT string_agg(mr.ai_summary, E'\n---\n' ORDER BY mr.completed_at DESC)
    FROM menu_results_v2 mr
    JOIN target t ON t.business_id = mr.business_id
    WHERE mr.status = 'done'
  ) AS raw_value,
         CASE WHEN EXISTS (
           SELECT 1 FROM menu_results_v2 mr
           JOIN target t ON t.business_id = mr.business_id
           WHERE mr.status = 'done' AND mr.ai_summary IS NOT NULL AND btrim(mr.ai_summary) <> ''
         ) THEN 'present' ELSE 'missing' END,
         CASE WHEN EXISTS (
           SELECT 1 FROM menu_results_v2 mr
           JOIN target t ON t.business_id = mr.business_id
           WHERE mr.status = 'done' AND mr.ai_summary IS NOT NULL AND btrim(mr.ai_summary) <> ''
         ) THEN 'mixed' ELSE 'n/a' END,
         'Usually good, but can be verbose'

  UNION ALL
  SELECT 'menu_results_v2.representative_dishes', 'menu_results_v2', 'representative_dishes', NULL::text,
         CASE WHEN EXISTS (
           SELECT 1 FROM menu_results_v2 mr
           JOIN target t ON t.business_id = mr.business_id
           WHERE mr.status = 'done' AND mr.representative_dishes IS NOT NULL
         ) THEN 'present' ELSE 'missing' END,
         CASE WHEN EXISTS (
           SELECT 1 FROM menu_results_v2 mr
           JOIN target t ON t.business_id = mr.business_id
           WHERE mr.status = 'done' AND mr.representative_dishes IS NOT NULL
         ) THEN 'good' ELSE 'n/a' END,
         'Compact curated dishes are AI-friendly'
) q
ORDER BY source_table, source_column, prompt_variable;