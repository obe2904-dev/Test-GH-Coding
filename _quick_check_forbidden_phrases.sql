-- Report: brand-profile-generator-v5 output inventory, V5 field map, and guardrail checks
-- Business id: f4679fa9-3120-4a59-9506-d059b010c34a

WITH target_business AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
)

SELECT
  'businesses' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  SELECT
    key AS field_name,
    value::text AS field_value,
    'businesses row' AS value_origin
  FROM jsonb_each(to_jsonb(b))
) AS f

UNION ALL

SELECT
  'business_brand_profile' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('business_archetype', bp.business_archetype::text, 'derived business archetype'),
    ('brand_profile_v5_version', bp.brand_profile_v5_version::text, 'fixed metadata'),
    ('brand_profile_v5_generated_at', bp.brand_profile_v5_generated_at::text, 'generated timestamp'),
    ('business_identity_persona', bp.business_identity_persona::text, 'generated from business data'),
    ('voice_guardrails', bp.voice_guardrails::text, 'generated from voice profile'),
    ('enhanced_social_examples', bp.enhanced_social_examples::text, 'generated from voice examples'),
    ('enhanced_avoid_examples', bp.enhanced_avoid_examples::text, 'generated from voice examples'),
    ('social_writing_examples', bp.social_writing_examples::text, 'generated or legacy fallback'),
    ('strategic_audience_segments', bp.strategic_audience_segments::text, 'generated from segmentation logic'),
    ('business_character', bp.business_character::text, 'generated with fallback compatibility'),
    ('tone_of_voice', bp.tone_of_voice::text, 'hardcoded null / deprecated')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_programme_profiles' AS table_name,
  CONCAT(p.business_id::text, ' / ', COALESCE(p.programme_type, 'unknown')) AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM business_programme_profiles p
JOIN target_business tb ON tb.business_id = p.business_id
CROSS JOIN LATERAL (
  VALUES
    ('programme_type', p.programme_type::text, 'generated from programme analysis'),
    ('programme_name', p.programme_name::text, 'generated from programme analysis'),
    ('time_windows', p.time_windows::text, 'generated from programme timing'),
    ('operating_days', p.operating_days::text, 'generated from programme timing'),
    ('menu_evidence', p.menu_evidence::text, 'generated from menu evidence'),
    ('confidence', p.confidence::text, 'computed confidence score'),
    ('baseline_goal_split', p.baseline_goal_split::text, 'computed programme goal split'),
    ('decision_timing', p.decision_timing::text, 'computed decision timing'),
    ('content_type_affinity', p.content_type_affinity::text, 'computed content affinity'),
    ('commercial_reasoning', p.commercial_reasoning::text, 'generated reasoning'),
    ('audience_segments', p.audience_segments::text, 'generated audience segments'),
    ('segment_confidence', p.segment_confidence::text, 'computed segment confidence'),
    ('segment_reasoning', p.segment_reasoning::text, 'generated segment reasoning'),
    ('created_at', p.created_at::text, 'row metadata'),
    ('updated_at', p.updated_at::text, 'row metadata')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('brand_profile_v5_json', jsonb_pretty(bp.brand_profile_v5)::text, 'nested generated JSONB profile')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.generation_metadata' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('version', bp.brand_profile_v5 ->> 'version', 'v5 metadata'),
    ('generated_at', bp.brand_profile_v5 ->> 'generated_at', 'v5 metadata'),
    ('request_id', bp.brand_profile_v5 #>> '{generation_metadata,request_id}', 'v5 metadata'),
    ('duration_ms', bp.brand_profile_v5 #>> '{generation_metadata,duration_ms}', 'v5 metadata'),
    ('ai_models_used', (bp.brand_profile_v5 #> '{generation_metadata,ai_models_used}')::text, 'v5 metadata'),
    ('ai_models_used.layer_2', bp.brand_profile_v5 #>> '{generation_metadata,ai_models_used,layer_2}', 'v5 metadata'),
    ('ai_models_used.layer_3', bp.brand_profile_v5 #>> '{generation_metadata,ai_models_used,layer_3}', 'v5 metadata'),
    ('ai_models_used.layer_4', bp.brand_profile_v5 #>> '{generation_metadata,ai_models_used,layer_4}', 'v5 metadata'),
    ('ai_models_used.layer_5', bp.brand_profile_v5 #>> '{generation_metadata,ai_models_used,layer_5}', 'v5 metadata')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.identity' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('brand_essence', bp.brand_profile_v5 #>> '{identity,brand_essence}', 'v5 identity'),
    ('positioning', bp.brand_profile_v5 #>> '{identity,positioning}', 'v5 identity'),
    ('core_values', (bp.brand_profile_v5 #> '{identity,core_values}')::text, 'v5 identity'),
    ('what_makes_us_different', bp.brand_profile_v5 #>> '{identity,what_makes_us_different}', 'v5 identity'),
    ('identity_confidence', bp.brand_profile_v5 #>> '{identity,identity_confidence}', 'v5 identity'),
    ('identity_reasoning', bp.brand_profile_v5 #>> '{identity,identity_reasoning}', 'v5 identity'),
    ('business_description', bp.brand_profile_v5 #>> '{identity,business_description}', 'v5 identity'),
    ('target_audience', (bp.brand_profile_v5 #> '{identity,target_audience}')::text, 'v5 identity'),
    ('communication_goal', bp.brand_profile_v5 #>> '{identity,communication_goal}', 'v5 identity'),
    ('emotional_promise', bp.brand_profile_v5 #>> '{identity,emotional_promise}', 'v5 identity'),
    ('brand_context', bp.brand_profile_v5 #>> '{identity,brand_context}', 'v5 identity'),
    ('venue_identity', bp.brand_profile_v5 #>> '{identity,venue_identity}', 'v5 identity'),
    ('visual_identity', bp.brand_profile_v5 #>> '{identity,visual_identity}', 'v5 identity'),
    ('business_character', bp.brand_profile_v5 #>> '{identity,business_character}', 'v5 identity'),
    ('local_location_reference', bp.brand_profile_v5 #>> '{identity,local_location_reference}', 'v5 identity'),
    ('layer_0.business_identity.system_persona', bp.brand_profile_v5 #>> '{layer_0_intelligence,business_identity,system_persona}', 'layer 0 compatibility'),
    ('layer_0.business_identity.metadata', (bp.brand_profile_v5 #> '{layer_0_intelligence,business_identity,metadata}')::text, 'layer 0 compatibility')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.layer_0_intelligence' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('business_type', (bp.brand_profile_v5 #> '{layer_0_intelligence,business_type}')::text, 'layer 0 intelligence'),
    ('geographic_context', (bp.brand_profile_v5 #> '{layer_0_intelligence,geographic_context}')::text, 'layer 0 intelligence'),
    ('professional_persona', (bp.brand_profile_v5 #> '{layer_0_intelligence,professional_persona}')::text, 'layer 0 intelligence'),
    ('voice_archetype', (bp.brand_profile_v5 #> '{layer_0_intelligence,voice_archetype}')::text, 'layer 0 intelligence'),
    ('business_identity.system_persona', bp.brand_profile_v5 #>> '{layer_0_intelligence,business_identity,system_persona}', 'layer 0 intelligence'),
    ('business_identity.metadata', (bp.brand_profile_v5 #> '{layer_0_intelligence,business_identity,metadata}')::text, 'layer 0 intelligence'),
    ('city_context_ai', (bp.brand_profile_v5 #> '{layer_0_intelligence,city_context_ai}')::text, 'layer 0 intelligence'),
    ('menu_overview', (bp.brand_profile_v5 #> '{layer_0_intelligence,menu_overview}')::text, 'layer 0 intelligence')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.guardrails.avoid_patterns' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('brochure_language', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns,brochure_language}')::text, 'v5 guardrails'),
    ('superlatives', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns,superlatives}')::text, 'v5 guardrails'),
    ('generic_marketing', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns,generic_marketing}')::text, 'v5 guardrails'),
    ('ai_tells', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns,ai_tells}')::text, 'v5 guardrails'),
    ('compound_sentences', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns,compound_sentences}')::text, 'v5 guardrails')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.guardrails.length_limits' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('instagram', (bp.brand_profile_v5 #> '{guardrails,length_limits,instagram}')::text, 'v5 guardrails'),
    ('facebook', (bp.brand_profile_v5 #> '{guardrails,length_limits,facebook}')::text, 'v5 guardrails'),
    ('google', (bp.brand_profile_v5 #> '{guardrails,length_limits,google}')::text, 'v5 guardrails'),
    ('story', (bp.brand_profile_v5 #> '{guardrails,length_limits,story}')::text, 'v5 guardrails')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.layer_1_programmes' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('layer_1_programmes', (bp.brand_profile_v5 -> 'layer_1_programmes')::text, 'layer 1-4 combined programmes')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.layer_1_programmes.items' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bp.brand_profile_v5 -> 'layer_1_programmes', '[]'::jsonb)) WITH ORDINALITY AS programme_item(programme_json, programme_index)
CROSS JOIN LATERAL (
  VALUES
    ('index', programme_index::text, 'layer 1 programme item'),
    ('type', programme_json ->> 'type', 'layer 1 programme item'),
    ('name', programme_json ->> 'name', 'layer 1 programme item'),
    ('timeWindow.start', programme_json #>> '{timeWindow,start}', 'layer 1 programme item'),
    ('timeWindow.end', programme_json #>> '{timeWindow,end}', 'layer 1 programme item'),
    ('daysOfWeek', (programme_json -> 'daysOfWeek')::text, 'layer 1 programme item'),
    ('confidence', programme_json ->> 'confidence', 'layer 1 programme item'),
    ('menuEvidence', (programme_json -> 'menuEvidence')::text, 'layer 1 programme item'),
    ('commercialOrientation.decision_timing', programme_json #>> '{commercialOrientation,decision_timing}', 'layer 1 programme item'),
    ('commercialOrientation.baseline_goal_split', (programme_json -> 'commercialOrientation' -> 'baseline_goal_split')::text, 'layer 1 programme item'),
    ('commercialOrientation.content_type_affinity', (programme_json -> 'commercialOrientation' -> 'content_type_affinity')::text, 'layer 1 programme item'),
    ('commercialOrientation.reasoning', programme_json #>> '{commercialOrientation,reasoning}', 'layer 1 programme item'),
    ('audienceSegments', (programme_json -> 'audienceSegments')::text, 'layer 1 programme item')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.layer_1_programmes.audience_segments' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bp.brand_profile_v5 -> 'layer_1_programmes', '[]'::jsonb)) WITH ORDINALITY AS programme_item(programme_json, programme_index)
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(programme_json -> 'audienceSegments', '[]'::jsonb)) WITH ORDINALITY AS segment_item(segment_json, segment_index)
CROSS JOIN LATERAL (
  VALUES
    ('programme_index', programme_index::text, 'layer 1 audience segment'),
    ('segment_index', segment_index::text, 'layer 1 audience segment'),
    ('segment_name', segment_json ->> 'segment_name', 'layer 1 audience segment'),
    ('motivation', segment_json ->> 'motivation', 'layer 1 audience segment'),
    ('timing_preference', segment_json ->> 'timing_preference', 'layer 1 audience segment'),
    ('content_angle', segment_json ->> 'content_angle', 'layer 1 audience segment'),
    ('confidence', segment_json ->> 'confidence', 'layer 1 audience segment')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.voice' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('tone_dna', (bp.brand_profile_v5 #> '{voice,tone_dna}')::text, 'layer 5 voice'),
    ('enhanced_social_examples', (bp.brand_profile_v5 #> '{voice,enhanced_social_examples}')::text, 'layer 5 voice'),
    ('enhanced_avoid_examples', (bp.brand_profile_v5 #> '{voice,enhanced_avoid_examples}')::text, 'layer 5 voice'),
    ('tone_rules', (bp.brand_profile_v5 #> '{voice,tone_rules}')::text, 'layer 5 voice'),
    ('structural_rules', (bp.brand_profile_v5 #> '{voice,structural_rules}')::text, 'layer 5 voice'),
    ('style_rules', (bp.brand_profile_v5 #> '{voice,style_rules}')::text, 'layer 5 voice'),
    ('personality_traits', (bp.brand_profile_v5 #> '{voice,personality_traits}')::text, 'layer 5 voice'),
    ('formality_level', bp.brand_profile_v5 #>> '{voice,formality_level}', 'layer 5 voice'),
    ('humor_style', bp.brand_profile_v5 #>> '{voice,humor_style}', 'layer 5 voice'),
    ('humor_level', bp.brand_profile_v5 #>> '{voice,humor_level}', 'layer 5 voice'),
    ('sentence_structure', bp.brand_profile_v5 #>> '{voice,sentence_structure}', 'layer 5 voice'),
    ('emoji_level', bp.brand_profile_v5 #>> '{voice,emoji_level}', 'layer 5 voice'),
    ('emoji_reasoning', bp.brand_profile_v5 #>> '{voice,emoji_reasoning}', 'layer 5 voice'),
    ('content_anchors', (bp.brand_profile_v5 #> '{voice,content_anchors}')::text, 'layer 5 voice'),
    ('menu_description_examples', (bp.brand_profile_v5 #> '{voice,menu_description_examples}')::text, 'layer 5 voice'),
    ('social_writing_examples', (bp.brand_profile_v5 #> '{voice,social_writing_examples}')::text, 'layer 5 voice'),
    ('menu_description_metadata', (bp.brand_profile_v5 #> '{voice,menu_description_metadata}')::text, 'layer 5 voice'),
    ('avoid_examples', (bp.brand_profile_v5 #> '{voice,avoid_examples}')::text, 'layer 5 voice'),
    ('register_guidance', bp.brand_profile_v5 #>> '{voice,register_guidance}', 'layer 5 voice'),
    ('voice_confidence', bp.brand_profile_v5 #>> '{voice,voice_confidence}', 'layer 5 voice'),
    ('voice_reasoning', bp.brand_profile_v5 #>> '{voice,voice_reasoning}', 'layer 5 voice'),
    ('enforcement_level', bp.brand_profile_v5 #>> '{voice,enforcement_level}', 'layer 5 voice'),
    ('sentence_length_max', bp.brand_profile_v5 #>> '{voice,sentence_length_max}', 'layer 5 voice')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.writing_examples' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('typical_openings', (bp.brand_profile_v5 #> '{writing_examples,typical_openings}')::text, 'layer 5 writing examples'),
    ('typical_closings', (bp.brand_profile_v5 #> '{writing_examples,typical_closings}')::text, 'layer 5 writing examples'),
    ('signature_phrases', (bp.brand_profile_v5 #> '{writing_examples,signature_phrases}')::text, 'layer 5 writing examples'),
    ('do_say_examples', (bp.brand_profile_v5 #> '{writing_examples,do_say_examples}')::text, 'layer 5 writing examples'),
    ('prefer_vocabulary', (bp.brand_profile_v5 #> '{writing_examples,prefer_vocabulary}')::text, 'layer 5 writing examples'),
    ('avoid_vocabulary', (bp.brand_profile_v5 #> '{writing_examples,avoid_vocabulary}')::text, 'layer 5 writing examples'),
    ('good_examples', (bp.brand_profile_v5 #> '{writing_examples,good_examples}')::text, 'layer 5 writing examples'),
    ('bad_examples', (bp.brand_profile_v5 #> '{writing_examples,bad_examples}')::text, 'layer 5 writing examples')
) AS f(field_name, field_value, value_origin)

UNION ALL

SELECT
  'business_brand_profile.brand_profile_v5.guardrails' AS table_name,
  b.id::text AS row_key,
  f.field_name,
  f.field_value,
  f.value_origin
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id
CROSS JOIN LATERAL (
  VALUES
    ('never_say', (bp.brand_profile_v5 #> '{guardrails,never_say}')::text, 'layer 5 guardrails'),
    ('content_exclusions', (bp.brand_profile_v5 #> '{guardrails,content_exclusions}')::text, 'layer 5 guardrails'),
    ('factual_constraints', (bp.brand_profile_v5 #> '{guardrails,factual_constraints}')::text, 'layer 5 guardrails'),
    ('seasonal_notes', (bp.brand_profile_v5 #> '{guardrails,seasonal_notes}')::text, 'layer 5 guardrails'),
    ('avoid_patterns', (bp.brand_profile_v5 #> '{guardrails,avoid_patterns}')::text, 'layer 5 guardrails'),
    ('wallpaper_avoidance', (bp.brand_profile_v5 #> '{guardrails,wallpaper_avoidance}')::text, 'layer 5 guardrails'),
    ('length_limits', (bp.brand_profile_v5 #> '{guardrails,length_limits}')::text, 'layer 5 guardrails')
) AS f(field_name, field_value, value_origin)

ORDER BY table_name, row_key, field_name;
