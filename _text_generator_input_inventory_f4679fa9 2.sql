-- Full generator input map for business f4679fa9-3120-4a59-9506-d059b010c34a
-- Shows all runtime, DB, and nested JSON inputs used by generate-text-from-idea.
-- Missing/legacy fields are listed explicitly so the report stays complete.

WITH profile AS (
  SELECT
    b.id AS business_id,
    b.name AS business_name,
    b.vertical,
    COALESCE(to_jsonb(bl), '{}'::jsonb) AS location_json,
    COALESCE(to_jsonb(bo), '{}'::jsonb) AS operations_json,
    COALESCE(to_jsonb(bli), '{}'::jsonb) AS location_intel_json,
    COALESCE(to_jsonb(bp), '{}'::jsonb) AS brand_json
  FROM businesses b
  LEFT JOIN business_locations bl
    ON bl.business_id = b.id AND bl.is_primary = true
  LEFT JOIN business_operations bo
    ON bo.business_id = b.id
  LEFT JOIN business_location_intelligence bli
    ON bli.business_id = b.id
  LEFT JOIN business_brand_profile bp
    ON bp.business_id = b.id
  WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
),
items AS (
  SELECT  1 AS sort_order, 'runtime' AS section, 'suggestion.source' AS field_name, 'runtime payload' AS source_path, 'runtime_only' AS source_state, NULL::jsonb AS value FROM profile
  UNION ALL SELECT  2, 'runtime', 'suggestion.contentType', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  3, 'runtime', 'suggestion.title', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  4, 'runtime', 'suggestion.menuItemId', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  5, 'runtime', 'suggestion.menuItemName', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  6, 'runtime', 'suggestion.menuItemDescription', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  7, 'runtime', 'suggestion.whyExplanation', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  8, 'runtime', 'suggestion.occasionContext', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT  9, 'runtime', 'suggestion.guestMoment', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 10, 'runtime', 'suggestion.timingDay', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 11, 'runtime', 'suggestion.timingTime', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 12, 'runtime', 'suggestion.selectionRationale', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 13, 'runtime', 'suggestion.goalMode', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 14, 'runtime', 'suggestion.ctaIntent', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 15, 'runtime', 'suggestion.platformFormat', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 16, 'runtime', 'suggestion.captionBase', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 17, 'runtime', 'suggestion.photoIdea/mediaSuggestion', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 18, 'runtime', 'weeklyPlanContext', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 19, 'runtime', 'selectedCta', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile
  UNION ALL SELECT 20, 'runtime', 'ctaStyle', 'runtime payload', 'runtime_only', NULL::jsonb FROM profile

  UNION ALL SELECT 30, 'business', 'businesses.name', 'business_json->>name', 'present_or_missing', to_jsonb(business_name) FROM profile
  UNION ALL SELECT 31, 'business', 'businesses.vertical', 'business_json->>vertical', 'present_or_missing', to_jsonb(vertical) FROM profile

  UNION ALL SELECT 40, 'location', 'business_locations.city', 'location_json->>city', 'present_or_missing', location_json -> 'city' FROM profile
  UNION ALL SELECT 41, 'location', 'business_locations.country', 'location_json->>country', 'present_or_missing', location_json -> 'country' FROM profile
  UNION ALL SELECT 42, 'location', 'business_locations.postal_code', 'location_json->>postal_code', 'present_or_missing', location_json -> 'postal_code' FROM profile
  UNION ALL SELECT 43, 'location', 'business_locations.address_line1', 'location_json->>address_line1', 'present_or_missing', location_json -> 'address_line1' FROM profile
  UNION ALL SELECT 44, 'location', 'business_locations.maps_url', 'location_json->>maps_url', 'present_or_missing', location_json -> 'maps_url' FROM profile
  UNION ALL SELECT 45, 'location', 'business_locations.phone', 'location_json->>phone', 'present_or_missing', location_json -> 'phone' FROM profile
  UNION ALL SELECT 46, 'location', 'business_locations.email', 'location_json->>email', 'present_or_missing', location_json -> 'email' FROM profile
  UNION ALL SELECT 47, 'location', 'business_locations.enrichment', 'location_json->enrichment', 'present_or_missing', location_json -> 'enrichment' FROM profile

  UNION ALL SELECT 60, 'location intelligence', 'business_location_intelligence.local_location_reference', 'location_intel_json->>local_location_reference', 'present_or_missing', location_intel_json -> 'local_location_reference' FROM profile
  UNION ALL SELECT 61, 'location intelligence', 'business_location_intelligence.neighborhood', 'location_intel_json->>neighborhood', 'present_or_missing', location_intel_json -> 'neighborhood' FROM profile
  UNION ALL SELECT 62, 'location intelligence', 'business_location_intelligence.area_type', 'location_intel_json->>area_type', 'present_or_missing', location_intel_json -> 'area_type' FROM profile
  UNION ALL SELECT 63, 'location intelligence', 'business_location_intelligence.neighborhood_character', 'location_intel_json->>neighborhood_character', 'present_or_missing', location_intel_json -> 'neighborhood_character' FROM profile
  UNION ALL SELECT 64, 'location intelligence', 'business_location_intelligence.category_scores', 'location_intel_json->category_scores', 'present_or_missing', location_intel_json -> 'category_scores' FROM profile
  UNION ALL SELECT 65, 'location intelligence', 'business_location_intelligence.location_marketing_hooks', 'location_intel_json->location_marketing_hooks', 'present_or_missing', location_intel_json -> 'location_marketing_hooks' FROM profile
  UNION ALL SELECT 66, 'location intelligence', 'business_location_intelligence.matched_motivations', 'location_intel_json->matched_motivations', 'present_or_missing', location_intel_json -> 'matched_motivations' FROM profile
  UNION ALL SELECT 67, 'location intelligence', 'business_location_intelligence.public_transport', 'location_intel_json->public_transport', 'present_or_missing', location_intel_json -> 'public_transport' FROM profile
  UNION ALL SELECT 68, 'location intelligence', 'business_location_intelligence.nearby_hospitality', 'location_intel_json->nearby_hospitality', 'present_or_missing', location_intel_json -> 'nearby_hospitality' FROM profile
  UNION ALL SELECT 69, 'location intelligence', 'business_location_intelligence.latitude', 'location_intel_json->latitude', 'present_or_missing', location_intel_json -> 'latitude' FROM profile
  UNION ALL SELECT 70, 'location intelligence', 'business_location_intelligence.longitude', 'location_intel_json->longitude', 'present_or_missing', location_intel_json -> 'longitude' FROM profile

  UNION ALL SELECT 80, 'operations', 'business_operations.price_level', 'operations_json->price_level', 'present_or_missing', operations_json -> 'price_level' FROM profile
  UNION ALL SELECT 81, 'operations', 'business_operations.establishment_type', 'operations_json->>establishment_type', 'present_or_missing', operations_json -> 'establishment_type' FROM profile
  UNION ALL SELECT 82, 'operations', 'business_operations.has_outdoor_seating', 'operations_json->has_outdoor_seating', 'present_or_missing', operations_json -> 'has_outdoor_seating' FROM profile
  UNION ALL SELECT 83, 'operations', 'business_operations.has_table_service', 'operations_json->has_table_service', 'present_or_missing', operations_json -> 'has_table_service' FROM profile
  UNION ALL SELECT 84, 'operations', 'business_operations.has_takeaway', 'operations_json->has_takeaway', 'present_or_missing', operations_json -> 'has_takeaway' FROM profile
  UNION ALL SELECT 85, 'operations', 'business_operations.has_delivery', 'operations_json->has_delivery', 'present_or_missing', operations_json -> 'has_delivery' FROM profile
  UNION ALL SELECT 86, 'operations', 'business_operations.has_kids_menu', 'operations_json->has_kids_menu', 'present_or_missing', operations_json -> 'has_kids_menu' FROM profile
  UNION ALL SELECT 87, 'operations', 'business_operations.has_english_menu', 'operations_json->has_english_menu', 'present_or_missing', operations_json -> 'has_english_menu' FROM profile
  UNION ALL SELECT 88, 'operations', 'business_operations.accepts_walk_ins', 'operations_json->accepts_walk_ins', 'present_or_missing', operations_json -> 'accepts_walk_ins' FROM profile
  UNION ALL SELECT 89, 'operations', 'business_operations.reservation_required', 'operations_json->reservation_required', 'present_or_missing', operations_json -> 'reservation_required' FROM profile
  UNION ALL SELECT 90, 'operations', 'business_operations.kitchen_close_time', 'operations_json->>kitchen_close_time', 'present_or_missing', to_jsonb(operations_json ->> 'kitchen_close_time') FROM profile
  UNION ALL SELECT 91, 'operations', 'business_operations.weekly_programme', 'operations_json->>weekly_programme', 'present_or_missing', to_jsonb(operations_json ->> 'weekly_programme') FROM profile
  UNION ALL SELECT 92, 'operations', 'business_operations.posting_occasions', 'operations_json->posting_occasions', 'present_or_missing', operations_json -> 'posting_occasions' FROM profile

  UNION ALL SELECT 110, 'brand', 'business_brand_profile.brand_essence', 'brand_json->>brand_essence', 'present_or_missing', brand_json -> 'brand_essence' FROM profile
  UNION ALL SELECT 111, 'brand', 'business_brand_profile.brand_essence_elaboration', 'brand_json->>brand_essence_elaboration', 'present_or_missing', brand_json -> 'brand_essence_elaboration' FROM profile
  UNION ALL SELECT 112, 'brand', 'business_brand_profile.tone_of_voice', 'brand_json->>tone_of_voice', 'present_or_missing', brand_json -> 'tone_of_voice' FROM profile
  UNION ALL SELECT 113, 'brand', 'business_brand_profile.tone_keywords', 'brand_json->tone_keywords', 'present_or_missing', brand_json -> 'tone_keywords' FROM profile
  UNION ALL SELECT 114, 'brand', 'business_brand_profile.tone_model', 'brand_json->tone_model', 'present_or_missing', brand_json -> 'tone_model' FROM profile
  UNION ALL SELECT 115, 'brand', 'business_brand_profile.target_audience', 'brand_json->target_audience', 'present_or_missing', brand_json -> 'target_audience' FROM profile
  UNION ALL SELECT 116, 'brand', 'business_brand_profile.core_offerings', 'brand_json->>core_offerings', 'present_or_missing', to_jsonb(brand_json ->> 'core_offerings') FROM profile
  UNION ALL SELECT 117, 'brand', 'business_brand_profile.content_focus', 'brand_json->>content_focus', 'present_or_missing', to_jsonb(brand_json ->> 'content_focus') FROM profile
  UNION ALL SELECT 118, 'brand', 'business_brand_profile.communication_goal', 'brand_json->>communication_goal', 'present_or_missing', to_jsonb(brand_json ->> 'communication_goal') FROM profile
  UNION ALL SELECT 119, 'brand', 'business_brand_profile.image_preferences', 'brand_json->>image_preferences', 'present_or_missing', to_jsonb(brand_json ->> 'image_preferences') FROM profile
  UNION ALL SELECT 120, 'brand', 'business_brand_profile.social_style', 'brand_json->social_style', 'present_or_missing', brand_json -> 'social_style' FROM profile
  UNION ALL SELECT 121, 'brand', 'business_brand_profile.voice_examples', 'brand_json->voice_examples', 'present_or_missing', brand_json -> 'voice_examples' FROM profile
  UNION ALL SELECT 122, 'brand', 'business_brand_profile.voice_constraints', 'brand_json->>voice_constraints', 'present_or_missing', to_jsonb(brand_json ->> 'voice_constraints') FROM profile
  UNION ALL SELECT 123, 'brand', 'business_brand_profile.things_to_avoid', 'brand_json->>things_to_avoid', 'present_or_missing', to_jsonb(brand_json ->> 'things_to_avoid') FROM profile
  UNION ALL SELECT 124, 'brand', 'business_brand_profile.do_not_say', 'brand_json->do_not_say', 'present_or_missing', brand_json -> 'do_not_say' FROM profile
  UNION ALL SELECT 125, 'brand', 'business_brand_profile.never_say', 'brand_json->never_say', 'present_or_missing', brand_json -> 'never_say' FROM profile
  UNION ALL SELECT 126, 'brand', 'business_brand_profile.what_makes_us_different', 'brand_json->>what_makes_us_different', 'present_or_missing', to_jsonb(brand_json ->> 'what_makes_us_different') FROM profile
  UNION ALL SELECT 127, 'brand', 'business_brand_profile.values', 'brand_json->values', 'present_or_missing', brand_json -> 'values' FROM profile
  UNION ALL SELECT 128, 'brand', 'business_brand_profile.certifications', 'brand_json->certifications', 'present_or_missing', brand_json -> 'certifications' FROM profile
  UNION ALL SELECT 129, 'brand', 'business_brand_profile.identity_keywords', 'brand_json->identity_keywords', 'present_or_missing', brand_json -> 'identity_keywords' FROM profile
  UNION ALL SELECT 130, 'brand', 'business_brand_profile.booking_link', 'brand_json->>booking_link', 'present_or_missing', to_jsonb(brand_json ->> 'booking_link') FROM profile
  UNION ALL SELECT 131, 'brand', 'business_brand_profile.cta_preference', 'brand_json->>cta_preference', 'present_or_missing', to_jsonb(brand_json ->> 'cta_preference') FROM profile
  UNION ALL SELECT 132, 'brand', 'business_brand_profile.quality_status', 'brand_json->>quality_status', 'present_or_missing', to_jsonb(brand_json ->> 'quality_status') FROM profile
  UNION ALL SELECT 133, 'brand', 'business_brand_profile.version_hash', 'brand_json->>version_hash', 'present_or_missing', to_jsonb(brand_json ->> 'version_hash') FROM profile
  UNION ALL SELECT 134, 'brand', 'business_brand_profile.generation_errors', 'brand_json->generation_errors', 'present_or_missing', brand_json -> 'generation_errors' FROM profile
  UNION ALL SELECT 135, 'brand', 'business_brand_profile.visual_character', 'brand_json->>visual_character', 'present_or_missing', to_jsonb(brand_json ->> 'visual_character') FROM profile
  UNION ALL SELECT 136, 'brand', 'business_brand_profile.venue_scene', 'brand_json->>venue_scene', 'present_or_missing', to_jsonb(brand_json ->> 'venue_scene') FROM profile
  UNION ALL SELECT 137, 'brand', 'business_brand_profile.venue_energy', 'brand_json->>venue_energy', 'present_or_missing', to_jsonb(brand_json ->> 'venue_energy') FROM profile
  UNION ALL SELECT 138, 'brand', 'business_brand_profile.recognizable_interior_identity', 'brand_json->>recognizable_interior_identity', 'present_or_missing', to_jsonb(brand_json ->> 'recognizable_interior_identity') FROM profile
  UNION ALL SELECT 139, 'brand', 'business_brand_profile.emotional_promise', 'brand_json->>emotional_promise', 'present_or_missing', to_jsonb(brand_json ->> 'emotional_promise') FROM profile
  UNION ALL SELECT 140, 'brand', 'business_brand_profile.content_exclusions', 'brand_json->>content_exclusions', 'present_or_missing', to_jsonb(brand_json ->> 'content_exclusions') FROM profile
  UNION ALL SELECT 141, 'brand', 'business_brand_profile.content_strategy_confirmed', 'brand_json->content_strategy_confirmed', 'present_or_missing', brand_json -> 'content_strategy_confirmed' FROM profile
  UNION ALL SELECT 142, 'brand', 'business_brand_profile.owner_document', 'brand_json->>owner_document', 'present_or_missing', to_jsonb(brand_json ->> 'owner_document') FROM profile
  UNION ALL SELECT 143, 'brand', 'business_brand_profile.voice_rationale', 'brand_json->>voice_rationale', 'present_or_missing', to_jsonb(brand_json ->> 'voice_rationale') FROM profile
  UNION ALL SELECT 144, 'brand', 'business_brand_profile.sample_posts', 'brand_json->sample_posts', 'present_or_missing', brand_json -> 'sample_posts' FROM profile
  UNION ALL SELECT 145, 'brand', 'business_brand_profile.typical_openings', 'brand_json->typical_openings', 'present_or_missing', brand_json -> 'typical_openings' FROM profile
  UNION ALL SELECT 146, 'brand', 'business_brand_profile.posting_occasions', 'brand_json->posting_occasions', 'present_or_missing', brand_json -> 'posting_occasions' FROM profile
  UNION ALL SELECT 147, 'brand', 'business_brand_profile.business_character', 'brand_json->>business_character', 'present_or_missing', to_jsonb(brand_json ->> 'business_character') FROM profile
  UNION ALL SELECT 148, 'brand', 'business_brand_profile.content_strategy', 'brand_json->content_strategy', 'present_or_missing', brand_json -> 'content_strategy' FROM profile
  UNION ALL SELECT 149, 'brand', 'business_brand_profile.signature_phrases', 'brand_json->signature_phrases', 'present_or_missing', brand_json -> 'signature_phrases' FROM profile
  UNION ALL SELECT 150, 'brand', 'business_brand_profile.humor_level', 'brand_json->>humor_level', 'present_or_missing', to_jsonb(brand_json ->> 'humor_level') FROM profile
  UNION ALL SELECT 151, 'brand', 'business_brand_profile.brand_context', 'brand_json->brand_context', 'present_or_missing', brand_json -> 'brand_context' FROM profile
  UNION ALL SELECT 152, 'brand', 'business_brand_profile.voice_options', 'brand_json->voice_options', 'present_or_missing', brand_json -> 'voice_options' FROM profile
  UNION ALL SELECT 153, 'brand', 'business_brand_profile.voice_archetype', 'brand_json->>voice_archetype', 'present_or_missing', to_jsonb(brand_json ->> 'voice_archetype') FROM profile
  UNION ALL SELECT 154, 'brand', 'business_brand_profile.core_offerings_jsonb', 'brand_json->core_offerings_jsonb', 'present_or_missing', brand_json -> 'core_offerings_jsonb' FROM profile
  UNION ALL SELECT 155, 'brand', 'business_brand_profile.image_preferences_jsonb', 'brand_json->image_preferences_jsonb', 'present_or_missing', brand_json -> 'image_preferences_jsonb' FROM profile
  UNION ALL SELECT 156, 'brand', 'business_brand_profile.things_to_avoid_jsonb', 'brand_json->things_to_avoid_jsonb', 'present_or_missing', brand_json -> 'things_to_avoid_jsonb' FROM profile
  UNION ALL SELECT 157, 'brand', 'business_brand_profile.location_intelligence', 'brand_json->location_intelligence', 'present_or_missing', brand_json -> 'location_intelligence' FROM profile
  UNION ALL SELECT 158, 'brand', 'business_brand_profile.enhanced_social_examples', 'brand_json->enhanced_social_examples', 'present_or_missing', brand_json -> 'enhanced_social_examples' FROM profile
  UNION ALL SELECT 159, 'brand', 'business_brand_profile.enhanced_avoid_examples', 'brand_json->enhanced_avoid_examples', 'present_or_missing', brand_json -> 'enhanced_avoid_examples' FROM profile
  UNION ALL SELECT 160, 'brand', 'business_brand_profile.social_writing_examples', 'brand_json->social_writing_examples', 'present_or_missing', brand_json -> 'social_writing_examples' FROM profile
  UNION ALL SELECT 161, 'brand', 'business_brand_profile.voice_guardrails', 'brand_json->voice_guardrails', 'present_or_missing', brand_json -> 'voice_guardrails' FROM profile

  UNION ALL SELECT 180, 'v5', 'business_brand_profile.brand_profile_v5', 'brand_json->brand_profile_v5', 'present_or_missing', brand_json -> 'brand_profile_v5' FROM profile
  UNION ALL SELECT 181, 'v5', 'business_brand_profile.brand_profile_v5.voice', 'brand_json#>brand_profile_v5.voice', 'present_or_missing', brand_json #> '{brand_profile_v5,voice}' FROM profile
  UNION ALL SELECT 182, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna', 'brand_json#>brand_profile_v5.voice.tone_dna', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_dna}' FROM profile
  UNION ALL SELECT 183, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.strategic_summary', 'brand_json#>>brand_profile_v5.voice.tone_dna.strategic_summary', 'present_or_missing', to_jsonb(brand_json #>> '{brand_profile_v5,voice,tone_dna,strategic_summary}') FROM profile
  UNION ALL SELECT 184, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.tone_do_list', 'brand_json#>brand_profile_v5.voice.tone_dna.tone_do_list', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_dna,tone_do_list}' FROM profile
  UNION ALL SELECT 185, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.tone_dont_list', 'brand_json#>brand_profile_v5.voice.tone_dna.tone_dont_list', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_dna,tone_dont_list}' FROM profile
  UNION ALL SELECT 186, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.location_driver.natural_vocabulary', 'brand_json#>brand_profile_v5.voice.tone_dna.location_driver.natural_vocabulary', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_dna,location_driver,natural_vocabulary}' FROM profile
  UNION ALL SELECT 187, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.location_driver.avoid_vocabulary', 'brand_json#>brand_profile_v5.voice.tone_dna.location_driver.avoid_vocabulary', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_dna,location_driver,avoid_vocabulary}' FROM profile
  UNION ALL SELECT 188, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_dna.recommended_tone.tone_positioning', 'brand_json#>>brand_profile_v5.voice.tone_dna.recommended_tone.tone_positioning', 'present_or_missing', to_jsonb(brand_json #>> '{brand_profile_v5,voice,tone_dna,recommended_tone,tone_positioning}') FROM profile
  UNION ALL SELECT 189, 'v5', 'business_brand_profile.brand_profile_v5.voice.tone_rules', 'brand_json#>brand_profile_v5.voice.tone_rules', 'present_or_missing', brand_json #> '{brand_profile_v5,voice,tone_rules}' FROM profile
  UNION ALL SELECT 190, 'v5', 'business_brand_profile.brand_profile_v5.voice.humor_style', 'brand_json#>>brand_profile_v5.voice.humor_style', 'present_or_missing', to_jsonb(brand_json #>> '{brand_profile_v5,voice,humor_style}') FROM profile
  UNION ALL SELECT 191, 'v5', 'business_brand_profile.brand_profile_v5.voice.formality_level', 'brand_json#>>brand_profile_v5.voice.formality_level', 'present_or_missing', to_jsonb(brand_json #>> '{brand_profile_v5,voice,formality_level}') FROM profile
  UNION ALL SELECT 192, 'v5', 'business_brand_profile.brand_profile_v5.writing_examples.signature_phrases', 'brand_json#>brand_profile_v5.writing_examples.signature_phrases', 'present_or_missing', brand_json #> '{brand_profile_v5,writing_examples,signature_phrases}' FROM profile
  UNION ALL SELECT 193, 'v5', 'business_brand_profile.brand_profile_v5.writing_examples.good_examples', 'brand_json#>brand_profile_v5.writing_examples.good_examples', 'present_or_missing', brand_json #> '{brand_profile_v5,writing_examples,good_examples}' FROM profile
  UNION ALL SELECT 194, 'v5', 'business_brand_profile.brand_profile_v5.writing_examples.avoid_examples', 'brand_json#>brand_profile_v5.writing_examples.avoid_examples', 'present_or_missing', brand_json #> '{brand_profile_v5,writing_examples,avoid_examples}' FROM profile
  UNION ALL SELECT 195, 'v5', 'business_brand_profile.brand_profile_v5.guardrails', 'brand_json#>brand_profile_v5.guardrails', 'present_or_missing', brand_json #> '{brand_profile_v5,guardrails}' FROM profile

  UNION ALL SELECT 210, 'legacy/missing', 'business_brand_profile.recognizable_interior_identity (flat)', 'not_a_live_flat_column', 'legacy_or_missing', to_jsonb(brand_json ->> 'recognizable_interior_identity') FROM profile
  UNION ALL SELECT 211, 'legacy/missing', 'business_brand_profile.signature_phrases (flat)', 'not_a_live_flat_column', 'legacy_or_missing', brand_json -> 'signature_phrases' FROM profile
  UNION ALL SELECT 212, 'legacy/missing', 'business_brand_profile.voice_guardrails.forbidden_phrases', 'brand_json#>voice_guardrails.forbidden_phrases', 'legacy_or_missing', brand_json #> '{voice_guardrails,forbidden_phrases}' FROM profile
  UNION ALL SELECT 213, 'legacy/missing', 'business_brand_profile.voice_guardrails.technical_terms', 'brand_json#>voice_guardrails.technical_terms', 'legacy_or_missing', brand_json #> '{voice_guardrails,technical_terms}' FROM profile
  UNION ALL SELECT 214, 'legacy/missing', 'business_brand_profile.voice_guardrails.weather_cliches', 'brand_json#>voice_guardrails.weather_cliches', 'legacy_or_missing', brand_json #> '{voice_guardrails,weather_cliches}' FROM profile
  UNION ALL SELECT 215, 'legacy/missing', 'business_brand_profile.voice_guardrails.avoid_patterns', 'brand_json#>voice_guardrails.avoid_patterns', 'legacy_or_missing', brand_json #> '{voice_guardrails,avoid_patterns}' FROM profile
)
SELECT
  sort_order,
  section,
  field_name,
  source_path,
  source_state,
  CASE
    WHEN source_state = 'runtime_only' THEN NULL
    WHEN source_state = 'legacy_or_missing' THEN value
    ELSE value
  END AS value,
  CASE
    WHEN source_state = 'runtime_only' THEN FALSE
    WHEN source_state = 'legacy_or_missing' THEN FALSE
    ELSE TRUE
  END AS source_exists,
  CASE
    WHEN value IS NULL THEN TRUE
    ELSE FALSE
  END AS value_is_null
FROM items
ORDER BY sort_order, section, field_name;
