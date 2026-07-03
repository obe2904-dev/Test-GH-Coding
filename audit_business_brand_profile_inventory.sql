-- Brand profile V5 inventory
-- Read-only report to determine which business_brand_profile fields exist
-- and whether they actually contain data for a representative business.

WITH target AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
),
brand_profile_row AS (
  SELECT bbp.*
  FROM business_brand_profile bbp
  JOIN target t ON t.business_id = bbp.business_id
),
candidate_columns AS (
  SELECT *
  FROM (
    VALUES
      ('tone_of_voice', 'text', 'Legacy tone string'),
      ('tone_keywords', 'array', 'Legacy tone keywords'),
      ('tone_model', 'jsonb', 'Legacy voice hints'),
      ('typical_openings', 'array', 'Writing examples fallback'),
      ('signature_phrases', 'array', 'Writing examples fallback'),
      ('never_say', 'array', 'Legacy guardrail hints'),
      ('things_to_avoid', 'text', 'Legacy guardrail hints'),
      ('voice_constraints', 'text', 'Legacy guardrail hints'),
      ('target_audience', 'jsonb', 'Persona context'),
      ('communication_goal', 'text', 'Persona context'),
      ('emotional_promise', 'text', 'Persona context'),
      ('brand_context', 'text', 'Persona context'),
      ('recognizable_interior_identity', 'text', 'Persona context'),
      ('visual_character', 'text', 'Persona context'),
      ('venue_scene', 'text', 'Persona context'),
      ('humor_level', 'text', 'Migrated to voice profile'),
      ('menu_overview_summary', 'text', 'Persona + voice context'),
      ('gastronomic_profile', 'text', 'Persona context'),
      ('signature_themes', 'array', 'Persona + voice context'),
      ('strategic_audience_segments', 'jsonb', 'Persona context'),
      ('business_character', 'text', 'Guardrails and persona context')
  ) AS v(column_name, value_kind, note)
),
table_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'business_brand_profile'
)
SELECT
  c.column_name,
  c.value_kind,
  c.note,
  CASE WHEN tc.column_name IS NULL THEN 'missing_column' ELSE 'present_column' END AS schema_state,
  COUNT(bbp.*) AS total_rows_scanned,
  COUNT(*) FILTER (WHERE to_jsonb(bbp) -> c.column_name IS NOT NULL) AS non_null_rows,
  COUNT(*) FILTER (
    WHERE COALESCE(NULLIF(btrim(to_jsonb(bbp) ->> c.column_name), ''), '') <> ''
  ) AS non_empty_rows,
  LEFT(
    MAX(NULLIF(btrim(to_jsonb(bbp) ->> c.column_name), '')),
    200
  ) AS sample_value
FROM candidate_columns c
LEFT JOIN table_columns tc
  ON tc.column_name = c.column_name
LEFT JOIN brand_profile_row bbp
  ON TRUE
GROUP BY c.column_name, c.value_kind, c.note, tc.column_name
ORDER BY c.column_name;