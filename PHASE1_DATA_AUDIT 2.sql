-- ============================================================================
-- PHASE 1: DATA AUDIT & MAPPING
-- Goal: Verify database structure and retrieve business intelligence data
-- Business: Cafe Faust (f4679fa9-3120-4a59-9506-d059b010c34a)
-- ============================================================================

-- ============================================================================
-- 1. VERIFY TABLE STRUCTURE
-- ============================================================================

-- 1.1 Check business_programme_profiles schema
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.2 Check brand_profile schema (voice, themes, etc.)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'brand_profile'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.3 Check location_intelligence schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'location_intelligence'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. RETRIEVE CAFE FAUST DATA
-- ============================================================================

-- 2.1 Programme Profiles with Commercial Strategy
SELECT 
  programme_name,
  programme_type,
  start_time,
  end_time,
  baseline_goal_split,
  commercial_reasoning,
  audience_segments,
  segment_confidence,
  decision_timing_mode
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY 
  CASE programme_type
    WHEN 'brunch' THEN 1
    WHEN 'lunch' THEN 2
    WHEN 'dinner' THEN 3
    WHEN 'bar' THEN 4
    ELSE 5
  END;

-- 2.2 Detailed Audience Segments Breakdown
SELECT 
  programme_name,
  jsonb_array_length(audience_segments) as segment_count,
  audience_segments
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND audience_segments IS NOT NULL
ORDER BY programme_name;

-- 2.3 Extract Individual Segments with Content Angles
SELECT 
  programme_name,
  seg->>'segment_type' as segment_type,
  seg->>'segment_name' as segment_name,
  seg->>'timing' as timing,
  seg->>'motivation' as motivation,
  seg->>'decision_type' as decision_type,
  seg->>'goal' as goal,
  seg->'content_angles' as content_angles
FROM business_programme_profiles,
  jsonb_array_elements(audience_segments) as seg
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND audience_segments IS NOT NULL
ORDER BY programme_name, segment_type;

-- 2.4 Location Intelligence
SELECT 
  area_type,
  waterfront_score,
  city_center_score,
  historic_score,
  residential_score,
  suburban_score,
  location_marketing_hooks,
  category_scores,
  competition_count,
  competition_analysis
FROM location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2.5 Brand Profile Voice & Themes
SELECT 
  voice_rules,
  personality_traits,
  tone_formality,
  humor_style,
  emoji_frequency,
  sentence_style,
  guardrails,
  signature_themes,
  gastronomic_profile,
  menu_summary
FROM brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- 3. DATA QUALITY CHECKS
-- ============================================================================

-- 3.1 Verify Commercial Strategy Completeness
SELECT 
  programme_name,
  baseline_goal_split,
  (baseline_goal_split->>'drive_footfall')::int as footfall_pct,
  (baseline_goal_split->>'strengthen_brand')::int as brand_pct,
  (baseline_goal_split->>'retain_regulars')::int as loyalty_pct,
  (
    COALESCE((baseline_goal_split->>'drive_footfall')::int, 0) +
    COALESCE((baseline_goal_split->>'strengthen_brand')::int, 0) +
    COALESCE((baseline_goal_split->>'retain_regulars')::int, 0)
  ) as total_should_be_100,
  decision_timing_mode,
  commercial_reasoning IS NOT NULL as has_reasoning
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3.2 Check Menu Items by Service Period
SELECT 
  service_period_name,
  COUNT(*) as item_count,
  COUNT(DISTINCT category_name) as category_count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY service_period_name
ORDER BY service_period_name;

-- 3.3 Verify Signature Dishes Availability
SELECT 
  item_name,
  service_period_name,
  category_name,
  item_description,
  is_signature
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_signature = true
ORDER BY service_period_name, item_name
LIMIT 20;

-- ============================================================================
-- 4. IDENTIFY DATA GAPS
-- ============================================================================

-- 4.1 Missing Commercial Strategy Data
SELECT 
  'Missing commercial reasoning' as issue,
  COUNT(*) as affected_programmes
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND commercial_reasoning IS NULL;

-- 4.2 Missing Audience Segments
SELECT 
  'Missing audience segments' as issue,
  COUNT(*) as affected_programmes
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (audience_segments IS NULL OR jsonb_array_length(audience_segments) = 0);

-- 4.3 Missing Location Scores
SELECT 
  'Missing location intelligence' as issue,
  CASE 
    WHEN waterfront_score IS NULL THEN 'waterfront_score'
    WHEN city_center_score IS NULL THEN 'city_center_score'
    WHEN location_marketing_hooks IS NULL THEN 'marketing_hooks'
    ELSE 'complete'
  END as missing_field
FROM location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- 5. CONSOLIDATED BUSINESS INTELLIGENCE VIEW
-- ============================================================================

-- 5.1 Complete Business Intelligence Summary
WITH programme_summary AS (
  SELECT 
    business_id,
    jsonb_object_agg(
      programme_name,
      jsonb_build_object(
        'type', programme_type,
        'hours', start_time || '-' || end_time,
        'goals', baseline_goal_split,
        'decision_timing', decision_timing_mode,
        'segments', audience_segments,
        'reasoning', commercial_reasoning
      )
    ) as programmes
  FROM business_programme_profiles
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  GROUP BY business_id
),
location_summary AS (
  SELECT 
    business_id,
    jsonb_build_object(
      'waterfront_score', waterfront_score,
      'city_center_score', city_center_score,
      'area_types', area_type,
      'marketing_hooks', location_marketing_hooks,
      'competition', jsonb_build_object(
        'count', competition_count,
        'analysis', competition_analysis
      )
    ) as location_data
  FROM location_intelligence
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
),
brand_summary AS (
  SELECT 
    business_id,
    jsonb_build_object(
      'voice_rules', voice_rules,
      'personality', personality_traits,
      'themes', signature_themes,
      'gastronomic_profile', gastronomic_profile
    ) as brand_data
  FROM brand_profile
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
)
SELECT 
  p.programmes,
  l.location_data,
  b.brand_data
FROM programme_summary p
LEFT JOIN location_summary l ON l.business_id = p.business_id
LEFT JOIN brand_summary b ON b.business_id = p.business_id;

-- ============================================================================
-- 6. SAMPLE DATA FOR PROMPT CONSTRUCTION
-- ============================================================================

-- 6.1 Show exactly what should go into Phase 2b prompt
SELECT 
  'COMMERCIAL STRATEGY CONTEXT:' as section,
  jsonb_pretty(
    jsonb_build_object(
      'service_periods', (
        SELECT jsonb_object_agg(
          programme_name,
          jsonb_build_object(
            'hours', start_time || '-' || end_time,
            'commercial_goals', jsonb_build_object(
              'drive_footfall', (baseline_goal_split->>'drive_footfall')::int,
              'strengthen_brand', (baseline_goal_split->>'strengthen_brand')::int,
              'retain_loyalty', COALESCE((baseline_goal_split->>'retain_regulars')::int, (baseline_goal_split->>'retain_loyalty')::int)
            ),
            'decision_timing', decision_timing_mode,
            'primary_audiences', (
              SELECT jsonb_agg(seg->>'segment_name')
              FROM jsonb_array_elements(audience_segments) as seg
              WHERE seg->>'segment_type' = 'primær'
            ),
            'content_angles', (
              SELECT jsonb_agg(DISTINCT angle)
              FROM jsonb_array_elements(audience_segments) as seg,
                   jsonb_array_elements_text(seg->'content_angles') as angle
            ),
            'ai_reasoning', commercial_reasoning
          )
        )
        FROM business_programme_profiles
        WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      ),
      'location_positioning', (
        SELECT jsonb_build_object(
          'primary', CASE 
            WHEN waterfront_score >= 90 THEN 'waterfront'
            WHEN city_center_score >= 85 THEN 'city_center'
            ELSE area_type
          END,
          'scores', jsonb_build_object(
            'waterfront', waterfront_score,
            'city_center', city_center_score
          ),
          'marketing_hooks', location_marketing_hooks,
          'competition', competition_count || ' venues within ' || (competition_analysis->>'radius') || 'm'
        )
        FROM location_intelligence
        WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      ),
      'brand_themes', (
        SELECT signature_themes
        FROM brand_profile
        WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      )
    )
  ) as prompt_context;
