-- Brand profile V5 active-input audit
-- One row per active prompt input for a single business_id.
-- This is the report to use before changing brand profile code.

WITH target AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
),
business_row AS (
  SELECT b.*
  FROM businesses b
  JOIN target t ON t.business_id = b.id
),
profile_owner_row AS (
  SELECT p.*
  FROM profiles p
  JOIN business_row b ON b.owner_id = p.id
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
brand_row AS (
  SELECT bbp.*
  FROM business_brand_profile bbp
  JOIN target t ON t.business_id = bbp.business_id
),
business_location_row AS (
  SELECT bl.*
  FROM business_locations bl
  JOIN target t ON t.business_id = bl.business_id
),
opening_hours_rows AS (
  SELECT oh.*
  FROM opening_hours oh
  JOIN target t ON t.business_id = oh.business_id
)
SELECT *
FROM (
  SELECT
    'businesses.name' AS prompt_variable,
    'businesses' AS source_table,
    'name' AS source_column,
    br.name::text AS raw_value,
    CASE WHEN br.name IS NULL OR btrim(br.name) = '' THEN 'missing' ELSE 'present' END AS data_state,
    CASE WHEN br.name IS NULL OR btrim(br.name) = '' THEN 'n/a' ELSE 'good' END AS ai_readiness,
    'Primary business name used in prompts' AS note
  FROM business_row br

  UNION ALL
  SELECT
    'businesses.category', 'businesses', 'category', br.category::text,
    CASE WHEN br.category IS NULL OR btrim(br.category) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN br.category IS NULL OR btrim(br.category) = '' THEN 'n/a' ELSE 'good' END,
    'Business category used for prompt framing'
  FROM business_row br

  UNION ALL
  SELECT
    'businesses.vertical', 'businesses', 'vertical', br.vertical::text,
    CASE WHEN br.vertical IS NULL OR btrim(br.vertical) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN br.vertical IS NULL OR btrim(br.vertical) = '' THEN 'n/a' ELSE 'good' END,
    'Legacy vertical fallback'
  FROM business_row br

  UNION ALL
  SELECT
    'businesses.country', 'businesses', 'country', br.country::text,
    CASE WHEN br.country IS NULL OR btrim(br.country) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN br.country IS NULL OR btrim(br.country) = '' THEN 'n/a' ELSE 'good' END,
    'Country fallback for language and city context'
  FROM business_row br

  UNION ALL
  SELECT
    'businesses.primary_language', 'businesses', 'primary_language', br.primary_language::text,
    CASE WHEN br.primary_language IS NULL OR btrim(br.primary_language) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN br.primary_language IS NULL OR btrim(br.primary_language) = '' THEN 'n/a' ELSE 'good' END,
    'Resolved language input'
  FROM business_row br

  UNION ALL
  SELECT
    'profiles.address', 'profiles', 'address', prf.address::text,
    CASE WHEN prf.address IS NULL OR btrim(prf.address) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN prf.address IS NULL OR btrim(prf.address) = '' THEN 'n/a' ELSE 'good' END,
    'Owner profile address used in prompt context'
  FROM profile_owner_row prf

  UNION ALL
  SELECT
    'business_locations.city', 'business_locations', 'city', lr.city::text,
    CASE WHEN lr.city IS NULL OR btrim(lr.city) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.city IS NULL OR btrim(lr.city) = '' THEN 'n/a' ELSE 'good' END,
    'Primary location city'
  FROM business_location_row lr

  UNION ALL
  SELECT
    'business_locations.postal_code', 'business_locations', 'postal_code', lr.postal_code::text,
    CASE WHEN lr.postal_code IS NULL OR btrim(lr.postal_code) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.postal_code IS NULL OR btrim(lr.postal_code) = '' THEN 'n/a' ELSE 'good' END,
    'Postal code for city inference'
  FROM business_location_row lr

  UNION ALL
  SELECT
    'business_locations.address_line1', 'business_locations', 'address_line1', lr.address_line1::text,
    CASE WHEN lr.address_line1 IS NULL OR btrim(lr.address_line1) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.address_line1 IS NULL OR btrim(lr.address_line1) = '' THEN 'n/a' ELSE 'good' END,
    'Address fallback'
  FROM business_location_row lr

  UNION ALL
  SELECT
    'business_profile.long_description', 'business_profile', 'long_description', pr.long_description::text,
    CASE WHEN pr.long_description IS NULL OR btrim(pr.long_description) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN pr.long_description IS NULL OR btrim(pr.long_description) = '' THEN 'n/a' ELSE 'mixed' END,
    'AI-facing business summary'
  FROM profile_row pr

  UNION ALL
  SELECT
    'business_location_intelligence.neighborhood_character', 'business_location_intelligence', 'neighborhood_character', lr.neighborhood_character::text,
    CASE WHEN lr.neighborhood_character IS NULL OR btrim(lr.neighborhood_character) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.neighborhood_character IS NULL OR btrim(lr.neighborhood_character) = '' THEN 'n/a' ELSE 'good' END,
    'Short context phrase is AI-friendly'
  FROM location_row lr

  UNION ALL
  SELECT
    'business_location_intelligence.area_type', 'business_location_intelligence', 'area_type', lr.area_type::text,
    CASE WHEN lr.area_type IS NULL OR btrim(lr.area_type) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.area_type IS NULL OR btrim(lr.area_type) = '' THEN 'n/a' ELSE 'good' END,
    'Location type for audience and voice prompts'
  FROM location_row lr

  UNION ALL
  SELECT
    'business_location_intelligence.category_scores', 'business_location_intelligence', 'category_scores', lr.category_scores::text,
    CASE WHEN lr.category_scores IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.category_scores IS NULL THEN 'n/a' ELSE 'mixed' END,
    'Structured location signals; may need flattening'
  FROM location_row lr

  UNION ALL
  SELECT
    'business_location_intelligence.local_location_reference', 'business_location_intelligence', 'local_location_reference', lr.local_location_reference::text,
    CASE WHEN lr.local_location_reference IS NULL OR btrim(lr.local_location_reference) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN lr.local_location_reference IS NULL OR btrim(lr.local_location_reference) = '' THEN 'n/a' ELSE 'good' END,
    'Source of truth for exact local location wording'
  FROM location_row lr

  UNION ALL
  SELECT
    'business_operations.establishment_type', 'business_operations', 'establishment_type', orow.establishment_type::text,
    CASE WHEN orow.establishment_type IS NULL OR btrim(orow.establishment_type) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.establishment_type IS NULL OR btrim(orow.establishment_type) = '' THEN 'n/a' ELSE 'good' END,
    'Compact code, AI-friendly'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.reservation_required', 'business_operations', 'reservation_required', orow.reservation_required::text,
    CASE WHEN orow.reservation_required IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.reservation_required IS NULL THEN 'n/a' ELSE 'good' END,
    'Booking model signal'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.accepts_walk_ins', 'business_operations', 'accepts_walk_ins', orow.accepts_walk_ins::text,
    CASE WHEN orow.accepts_walk_ins IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.accepts_walk_ins IS NULL THEN 'n/a' ELSE 'good' END,
    'Booking model signal'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.has_outdoor_seating', 'business_operations', 'has_outdoor_seating', orow.has_outdoor_seating::text,
    CASE WHEN orow.has_outdoor_seating IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.has_outdoor_seating IS NULL THEN 'n/a' ELSE 'good' END,
    'Used in tone and weather-sensitive prompts'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.has_takeaway', 'business_operations', 'has_takeaway', orow.has_takeaway::text,
    CASE WHEN orow.has_takeaway IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.has_takeaway IS NULL THEN 'n/a' ELSE 'good' END,
    'Used in persona/features'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.has_delivery', 'business_operations', 'has_delivery', orow.has_delivery::text,
    CASE WHEN orow.has_delivery IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.has_delivery IS NULL THEN 'n/a' ELSE 'good' END,
    'Used in persona/features'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.kitchen_close_time', 'business_operations', 'kitchen_close_time', orow.kitchen_close_time::text,
    CASE WHEN orow.kitchen_close_time IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.kitchen_close_time IS NULL THEN 'n/a' ELSE 'good' END,
    'Used for content timing and voice constraints'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_operations.price_level', 'business_operations', 'price_level', orow.price_level::text,
    CASE WHEN orow.price_level IS NULL OR btrim(orow.price_level) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN orow.price_level IS NULL OR btrim(orow.price_level) = '' THEN 'n/a' ELSE 'good' END,
    'Used in business profile context'
  FROM operations_row orow

  UNION ALL
  SELECT
    'business_brand_profile.tone_model', 'business_brand_profile', 'tone_model', brd.tone_model::text,
    CASE WHEN brd.tone_model IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.tone_model IS NULL THEN 'n/a' ELSE 'mixed' END,
    'Legacy voice hints'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.voice_constraints', 'business_brand_profile', 'voice_constraints', brd.voice_constraints::text,
    CASE WHEN brd.voice_constraints IS NULL OR btrim(brd.voice_constraints) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.voice_constraints IS NULL OR btrim(brd.voice_constraints) = '' THEN 'n/a' ELSE 'good' END,
    'Legacy guardrail hints'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.things_to_avoid', 'business_brand_profile', 'things_to_avoid', brd.things_to_avoid::text,
    CASE WHEN brd.things_to_avoid IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.things_to_avoid IS NULL THEN 'n/a' ELSE 'mixed' END,
    'Legacy guardrail hints'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.typical_openings', 'business_brand_profile', 'typical_openings', brd.typical_openings::text,
    CASE WHEN brd.typical_openings IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.typical_openings IS NULL THEN 'n/a' ELSE 'good' END,
    'Writing examples fallback'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.signature_phrases', 'business_brand_profile', 'signature_phrases', brd.signature_phrases::text,
    CASE WHEN brd.signature_phrases IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.signature_phrases IS NULL THEN 'n/a' ELSE 'good' END,
    'Writing examples fallback'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.menu_overview_summary', 'business_brand_profile', 'menu_overview_summary', brd.menu_overview_summary::text,
    CASE WHEN brd.menu_overview_summary IS NULL OR btrim(brd.menu_overview_summary) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.menu_overview_summary IS NULL OR btrim(brd.menu_overview_summary) = '' THEN 'n/a' ELSE 'mixed' END,
    'Persona + voice context'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.gastronomic_profile', 'business_brand_profile', 'gastronomic_profile', brd.gastronomic_profile::text,
    CASE WHEN brd.gastronomic_profile IS NULL OR btrim(brd.gastronomic_profile) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.gastronomic_profile IS NULL OR btrim(brd.gastronomic_profile) = '' THEN 'n/a' ELSE 'good' END,
    'Persona context'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.signature_themes', 'business_brand_profile', 'signature_themes', brd.signature_themes::text,
    CASE WHEN brd.signature_themes IS NULL THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.signature_themes IS NULL THEN 'n/a' ELSE 'good' END,
    'Persona + voice context'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.business_character', 'business_brand_profile', 'business_character', brd.business_character::text,
    CASE WHEN brd.business_character IS NULL OR btrim(brd.business_character) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.business_character IS NULL OR btrim(brd.business_character) = '' THEN 'n/a' ELSE 'good' END,
    'Guardrails and persona context'
  FROM brand_row brd

  UNION ALL
  SELECT
    'business_brand_profile.humor_level', 'business_brand_profile', 'humor_level', brd.humor_level::text,
    CASE WHEN brd.humor_level IS NULL OR btrim(brd.humor_level) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN brd.humor_level IS NULL OR btrim(brd.humor_level) = '' THEN 'n/a' ELSE 'good' END,
    'Migrated to voice profile'
  FROM brand_row brd

  UNION ALL
  SELECT
    'menu_results_v2.ai_summary', 'menu_results_v2', 'ai_summary', (
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
  SELECT
    'menu_results_v2.structured_data', 'menu_results_v2', 'structured_data', NULL::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.structured_data IS NOT NULL
    ) THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.structured_data IS NOT NULL
    ) THEN 'mixed' ELSE 'n/a' END,
    'Structured menu JSON used downstream'

  UNION ALL
  SELECT
    'menu_results_v2.service_periods', 'menu_results_v2', 'service_periods', NULL::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.service_periods IS NOT NULL
    ) THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.service_periods IS NOT NULL
    ) THEN 'good' ELSE 'n/a' END,
    'Used in prompt filtering and timing'

  UNION ALL
  SELECT
    'menu_results_v2.service_period_name', 'menu_results_v2', 'service_period_name', NULL::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.service_period_name IS NOT NULL AND btrim(mr.service_period_name) <> ''
    ) THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.service_period_name IS NOT NULL AND btrim(mr.service_period_name) <> ''
    ) THEN 'good' ELSE 'n/a' END,
    'Used in prompt filtering and voice'

  UNION ALL
  SELECT
    'menu_results_v2.representative_dishes', 'menu_results_v2', 'representative_dishes', NULL::text,
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

  UNION ALL
  SELECT
    'menu_results_v2.language_code', 'menu_results_v2', 'language_code', NULL::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.language_code IS NOT NULL
    ) THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM menu_results_v2 mr
      JOIN target t ON t.business_id = mr.business_id
      WHERE mr.status = 'done' AND mr.language_code IS NOT NULL
    ) THEN 'good' ELSE 'n/a' END,
    'Used in language filtering'

  UNION ALL
  SELECT
    'opening_hours.weekday', 'opening_hours', 'weekday', oh.weekday::text,
    CASE WHEN oh.weekday IS NULL OR btrim(oh.weekday) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN oh.weekday IS NULL OR btrim(oh.weekday) = '' THEN 'n/a' ELSE 'good' END,
    'Used in persona and audience prompts'
  FROM opening_hours_rows oh

  UNION ALL
  SELECT
    'opening_hours.open_time', 'opening_hours', 'open_time', oh.open_time::text,
    CASE WHEN oh.open_time IS NULL OR btrim(oh.open_time::text) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN oh.open_time IS NULL OR btrim(oh.open_time::text) = '' THEN 'n/a' ELSE 'good' END,
    'Used in persona and audience prompts'
  FROM opening_hours_rows oh

  UNION ALL
  SELECT
    'opening_hours.close_time', 'opening_hours', 'close_time', oh.close_time::text,
    CASE WHEN oh.close_time IS NULL OR btrim(oh.close_time::text) = '' THEN 'missing' ELSE 'present' END,
    CASE WHEN oh.close_time IS NULL OR btrim(oh.close_time::text) = '' THEN 'n/a' ELSE 'good' END,
    'Used in persona and audience prompts'
  FROM opening_hours_rows oh
) q
ORDER BY source_table, source_column, prompt_variable;
