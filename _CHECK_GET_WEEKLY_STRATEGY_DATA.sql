-- =====================================================
-- CHECK DATA USED BY get-weekly-strategy
-- =====================================================
-- Replace the UUID below with the business_id you want to inspect.
-- The query returns one row per source table with populated-field counts.
-- =====================================================

WITH target AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
),
coverage AS (
  SELECT
    'businesses' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'owner_id', COUNT(*) FILTER (WHERE owner_id IS NOT NULL),
      'name', COUNT(*) FILTER (WHERE name IS NOT NULL AND btrim(name) <> ''),
      'category', COUNT(*) FILTER (WHERE category IS NOT NULL AND btrim(category) <> ''),
      'ai_generations_today', COUNT(*) FILTER (WHERE ai_generations_today IS NOT NULL)
    ) AS stats
  FROM businesses
  WHERE id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'business_locations' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'city', COUNT(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> ''),
      'country', COUNT(*) FILTER (WHERE country IS NOT NULL AND btrim(country) <> '')
    ) AS stats
  FROM business_locations
  WHERE business_id = (SELECT business_id FROM target)
    AND is_primary = true

  UNION ALL

  SELECT
    'business_location_intelligence' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'neighborhood', COUNT(*) FILTER (WHERE neighborhood IS NOT NULL AND btrim(neighborhood) <> ''),
      'area_type', COUNT(*) FILTER (WHERE area_type IS NOT NULL AND btrim(area_type) <> ''),
      'category_scores', COUNT(*) FILTER (WHERE category_scores IS NOT NULL AND category_scores <> '{}'::jsonb AND category_scores <> '[]'::jsonb),
      'location_marketing_hooks', COUNT(*) FILTER (WHERE location_marketing_hooks IS NOT NULL AND cardinality(location_marketing_hooks) > 0),
      'latitude', COUNT(*) FILTER (WHERE latitude IS NOT NULL),
      'longitude', COUNT(*) FILTER (WHERE longitude IS NOT NULL),
      'local_location_reference', COUNT(*) FILTER (WHERE local_location_reference IS NOT NULL AND btrim(local_location_reference) <> '')
    ) AS stats
  FROM business_location_intelligence
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'business_operations' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'has_outdoor_seating', COUNT(*) FILTER (WHERE has_outdoor_seating IS NOT NULL),
      'establishment_type', COUNT(*) FILTER (WHERE establishment_type IS NOT NULL AND btrim(establishment_type) <> ''),
      'reservation_required', COUNT(*) FILTER (WHERE reservation_required IS NOT NULL),
      'accepts_walk_ins', COUNT(*) FILTER (WHERE accepts_walk_ins IS NOT NULL),
      'enabled_menu_languages', COUNT(*) FILTER (WHERE enabled_menu_languages IS NOT NULL AND cardinality(enabled_menu_languages) > 0),
      'kitchen_close_time', COUNT(*) FILTER (WHERE kitchen_close_time IS NOT NULL),
      'has_takeaway', COUNT(*) FILTER (WHERE has_takeaway IS NOT NULL),
      'has_table_service', COUNT(*) FILTER (WHERE has_table_service IS NOT NULL)
    ) AS stats
  FROM business_operations
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'opening_hours' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'weekday', COUNT(*) FILTER (WHERE weekday IS NOT NULL AND btrim(weekday) <> ''),
      'closed', COUNT(*) FILTER (WHERE closed IS NOT NULL),
      'open_time', COUNT(*) FILTER (WHERE open_time IS NOT NULL),
      'close_time', COUNT(*) FILTER (WHERE close_time IS NOT NULL)
    ) AS stats
  FROM opening_hours
  WHERE business_id = (SELECT business_id FROM target)
    AND kind = 'normal'

  UNION ALL

  SELECT
    'business_brand_profile' AS source,
    (
      WITH brand_profile_rows AS (
        SELECT to_jsonb(bbp) AS row_json
        FROM business_brand_profile bbp
        WHERE bbp.business_id = (SELECT business_id FROM target)
      ),
      expected_fields AS (
        SELECT *
        FROM (VALUES
          ('business_character', 'text'),
          ('business_archetype', 'text'),
          ('revenue_drivers', 'jsonb'),
          ('brand_profile_v5', 'jsonb'),
          ('brand_essence', 'text'),
          ('brand_essence_elaboration', 'text'),
          ('what_makes_us_different', 'text'),
          ('gastronomic_profile', 'text'),
          ('posting_strategy', 'jsonb'),
          ('busy_pattern', 'jsonb'),
          ('voice_guardrails', 'jsonb'),
          ('business_identity_persona', 'text'),
          ('booking_link', 'text'),
          ('target_type_mix', 'jsonb'),
          ('things_to_avoid', 'text'),
          ('content_focus', 'text'),
          ('signature_phrases', 'text_array'),
          ('never_say', 'text_array'),
          ('typical_openings', 'text_array'),
          ('typical_closings', 'text_array'),
          ('communication_goal', 'text'),
          ('humor_level', 'text'),
          ('core_offerings', 'text'),
          ('identity_keywords', 'text_array'),
          ('voice_constraints', 'text'),
          ('content_strategy', 'jsonb'),
          ('voice_rationale', 'text'),
          ('recognizable_interior_identity', 'text')
        ) AS t(field_name, field_kind)
      ),
      actual_columns AS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_brand_profile'
      ),
      field_counts AS (
        SELECT
          e.field_name,
          COUNT(*) FILTER (
            WHERE CASE e.field_kind
              WHEN 'text' THEN NULLIF(btrim(COALESCE(r.row_json ->> e.field_name, '')), '') IS NOT NULL
              WHEN 'text_array' THEN CASE
                WHEN r.row_json ? e.field_name AND jsonb_typeof(r.row_json -> e.field_name) = 'array' THEN jsonb_array_length(r.row_json -> e.field_name) > 0
                ELSE false
              END
              WHEN 'jsonb' THEN CASE
                WHEN r.row_json ? e.field_name THEN
                  r.row_json -> e.field_name IS NOT NULL
                  AND r.row_json -> e.field_name <> '{}'::jsonb
                  AND r.row_json -> e.field_name <> '[]'::jsonb
                  AND r.row_json -> e.field_name <> 'null'::jsonb
                ELSE false
              END
              ELSE false
            END
          ) AS populated_count
        FROM expected_fields e
        LEFT JOIN brand_profile_rows r ON true
        GROUP BY e.field_name
      )
      SELECT
        jsonb_build_object(
          'rows', (SELECT COUNT(*) FROM brand_profile_rows),
          'missing_fields', COALESCE(
            (
              SELECT jsonb_agg(e.field_name ORDER BY e.field_name)
              FROM expected_fields e
              LEFT JOIN actual_columns a ON a.column_name = e.field_name
              WHERE a.column_name IS NULL
            ),
            '[]'::jsonb
          )
        )
        || COALESCE(
          (
            SELECT jsonb_object_agg(field_name, populated_count)
            FROM field_counts
          ),
          '{}'::jsonb
        )
    ) AS stats

  UNION ALL

  SELECT
    'business_profile' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'menu_signal', COUNT(*) FILTER (WHERE menu_signal IS NOT NULL AND menu_signal <> '{}'::jsonb AND menu_signal <> '[]'::jsonb)
    ) AS stats
  FROM business_profile
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'menu_items_normalized' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'item_name', COUNT(*) FILTER (WHERE item_name IS NOT NULL AND btrim(item_name) <> ''),
      'item_description', COUNT(*) FILTER (WHERE item_description IS NOT NULL AND btrim(item_description) <> ''),
      'category_name', COUNT(*) FILTER (WHERE category_name IS NOT NULL AND btrim(category_name) <> ''),
      'menu_language', COUNT(*) FILTER (WHERE menu_language IS NOT NULL AND btrim(menu_language) <> ''),
      'service_periods', COUNT(*) FILTER (WHERE service_periods IS NOT NULL AND cardinality(service_periods) > 0),
      'service_period_name', COUNT(*) FILTER (WHERE service_period_name IS NOT NULL AND btrim(service_period_name) <> ''),
      'menu_result_id', COUNT(*) FILTER (WHERE menu_result_id IS NOT NULL)
    ) AS stats
  FROM menu_items_normalized
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'menu_results_v2' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'id', COUNT(*) FILTER (WHERE id IS NOT NULL),
      'language_code', COUNT(*) FILTER (WHERE language_code IS NOT NULL AND btrim(language_code) <> ''),
      'structured_data', COUNT(*) FILTER (WHERE structured_data IS NOT NULL AND structured_data <> '{}'::jsonb AND structured_data <> '[]'::jsonb),
      'service_periods', COUNT(*) FILTER (WHERE service_periods IS NOT NULL AND cardinality(service_periods) > 0),
      'is_signature', COUNT(*) FILTER (WHERE is_signature IS NOT NULL),
      'ai_summary', COUNT(*) FILTER (WHERE ai_summary IS NOT NULL AND btrim(ai_summary) <> ''),
      'source_url', COUNT(*) FILTER (WHERE source_url IS NOT NULL AND btrim(source_url) <> ''),
      'service_period_name', COUNT(*) FILTER (WHERE service_period_name IS NOT NULL AND btrim(service_period_name) <> ''),
      'status_done', COUNT(*) FILTER (WHERE status = 'done')
    ) AS stats
  FROM menu_results_v2
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'business_programme_profiles' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'programme_type', COUNT(*) FILTER (WHERE programme_type IS NOT NULL AND btrim(programme_type) <> ''),
      'programme_name', COUNT(*) FILTER (WHERE programme_name IS NOT NULL AND btrim(programme_name) <> ''),
      'time_windows', COUNT(*) FILTER (WHERE time_windows IS NOT NULL AND cardinality(time_windows) > 0),
      'operating_days', COUNT(*) FILTER (WHERE operating_days IS NOT NULL AND cardinality(operating_days) > 0),
      'is_active', COUNT(*) FILTER (WHERE is_active IS TRUE),
      'decision_timing', COUNT(*) FILTER (WHERE decision_timing IS NOT NULL AND btrim(decision_timing) <> ''),
      'accepts_reservations', COUNT(*) FILTER (WHERE accepts_reservations IS NOT NULL),
      'baseline_goal_split', COUNT(*) FILTER (WHERE baseline_goal_split IS NOT NULL AND baseline_goal_split <> '{}'::jsonb AND baseline_goal_split <> '[]'::jsonb)
    ) AS stats
  FROM business_programme_profiles
  WHERE business_id = (SELECT business_id FROM target)
    AND is_active = true

  UNION ALL

  SELECT
    'profiles' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'selected_platforms', COUNT(*) FILTER (
        WHERE selected_platforms IS NOT NULL
          AND jsonb_typeof(selected_platforms) = 'array'
          AND jsonb_array_length(selected_platforms) > 0
      )
    ) AS stats
  FROM profiles
  WHERE id = (SELECT owner_id FROM businesses WHERE id = (SELECT business_id FROM target))

  UNION ALL

  SELECT
    'contextual_calendar' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'event_type', COUNT(*) FILTER (WHERE event_type IS NOT NULL AND btrim(event_type) <> ''),
      'event_name', COUNT(*) FILTER (WHERE event_name IS NOT NULL AND btrim(event_name) <> ''),
      'date_start', COUNT(*) FILTER (WHERE date_start IS NOT NULL),
      'date_end', COUNT(*) FILTER (WHERE date_end IS NOT NULL),
      'relevance_tags', COUNT(*) FILTER (WHERE relevance_tags IS NOT NULL AND cardinality(relevance_tags) > 0),
      'content_angle', COUNT(*) FILTER (WHERE content_angle IS NOT NULL AND btrim(content_angle) <> ''),
      'marketing_hook', COUNT(*) FILTER (WHERE marketing_hook IS NOT NULL AND btrim(marketing_hook) <> ''),
      'commercial_weight', COUNT(*) FILTER (WHERE commercial_weight IS NOT NULL),
      'lead_days', COUNT(*) FILTER (WHERE lead_days IS NOT NULL)
    ) AS stats
  FROM contextual_calendar
  WHERE country = COALESCE((SELECT country FROM business_locations WHERE business_id = (SELECT business_id FROM target) AND is_primary = true LIMIT 1), 'DK')

  UNION ALL

  SELECT
    'weekly_content_plans' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'posts', COUNT(*) FILTER (WHERE posts IS NOT NULL AND posts <> '[]'::jsonb),
      'generated_at', COUNT(*) FILTER (WHERE generated_at IS NOT NULL)
    ) AS stats
  FROM weekly_content_plans
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'published_posts' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'menu_item_name', COUNT(*) FILTER (WHERE menu_item_name IS NOT NULL AND btrim(menu_item_name) <> ''),
      'content_type', COUNT(*) FILTER (WHERE content_type IS NOT NULL AND btrim(content_type) <> ''),
      'posted_at', COUNT(*) FILTER (WHERE posted_at IS NOT NULL)
    ) AS stats
  FROM published_posts
  WHERE business_id = (SELECT business_id FROM target)

  UNION ALL

  SELECT
    'post_ideas' AS source,
    jsonb_build_object(
      'rows', 0,
      'table_missing', NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'post_ideas'
      ),
      'missing_fields', '[]'::jsonb
    ) AS stats

  UNION ALL

  SELECT
    'weekly_strategies' AS source,
    jsonb_build_object(
      'rows', COUNT(*),
      'id', COUNT(*) FILTER (WHERE id IS NOT NULL),
      'status', COUNT(*) FILTER (WHERE status IS NOT NULL AND btrim(status) <> ''),
      'narrative', COUNT(*) FILTER (WHERE narrative IS NOT NULL AND narrative <> '{}'::jsonb AND narrative <> '[]'::jsonb),
      'strategic_priorities', COUNT(*) FILTER (WHERE strategic_priorities IS NOT NULL AND strategic_priorities <> '{}'::jsonb AND strategic_priorities <> '[]'::jsonb),
      'post_ideas', COUNT(*) FILTER (WHERE post_ideas IS NOT NULL AND post_ideas <> '{}'::jsonb AND post_ideas <> '[]'::jsonb),
      'selected_idea_ids', COUNT(*) FILTER (WHERE selected_idea_ids IS NOT NULL AND cardinality(selected_idea_ids) > 0),
      'strategy_rationale', COUNT(*) FILTER (WHERE strategy_rationale IS NOT NULL AND btrim(strategy_rationale) <> ''),
      'strategic_brief', COUNT(*) FILTER (WHERE strategic_brief IS NOT NULL AND strategic_brief <> '{}'::jsonb AND strategic_brief <> '[]'::jsonb),
      'strategic_brief_raw', COUNT(*) FILTER (WHERE strategic_brief_raw IS NOT NULL AND btrim(strategic_brief_raw) <> ''),
      'strategy_version', COUNT(*) FILTER (WHERE strategy_version IS NOT NULL AND btrim(strategy_version) <> ''),
      'generated_at', COUNT(*) FILTER (WHERE generated_at IS NOT NULL),
      'week_start', COUNT(*) FILTER (WHERE week_start IS NOT NULL),
      'week_number', COUNT(*) FILTER (WHERE week_number IS NOT NULL)
    ) AS stats
  FROM weekly_strategies
  WHERE business_id = (SELECT business_id FROM target)
)
SELECT source, stats
FROM coverage
ORDER BY source;