-- =====================================================
-- TEST: Analyze Revenue Drivers for Cafe Faust
-- =====================================================
-- Tests the AI revenue driver analyzer with Cafe Faust
-- (hybrid cafe + bar example)
-- =====================================================

-- ── 1. Check current business_about ───────────────────
SELECT 
  business_id,
  business_about,
  service_periods,
  revenue_drivers IS NOT NULL AS has_revenue_drivers
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ── 2. View existing revenue_drivers (if any) ────────
SELECT 
  business_id,
  revenue_drivers -> 'analyzed_at' AS analyzed_at,
  revenue_drivers -> 'confidence_score' AS confidence_score,
  revenue_drivers -> 'primary_revenue_moment' ->> 'moment_id' AS primary_moment,
  revenue_drivers -> 'primary_revenue_moment' ->> 'label' AS primary_label,
  jsonb_array_length(revenue_drivers -> 'secondary_revenue_moments') AS secondary_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND revenue_drivers IS NOT NULL;

-- ── 3. View primary revenue moment details ───────────
SELECT 
  business_id,
  revenue_drivers -> 'primary_revenue_moment' ->> 'moment_id' AS moment_id,
  revenue_drivers -> 'primary_revenue_moment' ->> 'service_type' AS service_type,
  revenue_drivers -> 'primary_revenue_moment' -> 'days' AS days,
  revenue_drivers -> 'primary_revenue_moment' ->> 'time_range' AS time_range,
  revenue_drivers -> 'primary_revenue_moment' ->> 'decision_pattern' AS decision_pattern,
  revenue_drivers -> 'primary_revenue_moment' -> 'decision_windows' AS decision_windows,
  revenue_drivers -> 'primary_revenue_moment' -> 'post_timing_rules' AS post_timing_rules
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND revenue_drivers IS NOT NULL;

-- ── 4. View secondary revenue moments ─────────────────
SELECT 
  business_id,
  idx + 1 AS moment_number,
  moment ->> 'moment_id' AS moment_id,
  moment ->> 'label' AS label,
  moment ->> 'importance' AS importance,
  moment ->> 'service_type' AS service_type,
  moment -> 'days' AS days,
  moment ->> 'decision_pattern' AS decision_pattern
FROM business_brand_profile,
  jsonb_array_elements(revenue_drivers -> 'secondary_revenue_moments') WITH ORDINALITY AS arr(moment, idx)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND revenue_drivers IS NOT NULL
ORDER BY idx;

-- ── 5. View normal week strategy ──────────────────────
SELECT 
  business_id,
  revenue_drivers -> 'normal_week_strategy' -> 'minimum_coverage' AS minimum_coverage,
  revenue_drivers -> 'normal_week_strategy' -> 'preferred_days' AS preferred_days,
  revenue_drivers -> 'normal_week_strategy' ->> 'rationale' AS rationale
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND revenue_drivers IS NOT NULL;

-- ── 6. Validate post timing rules for all moments ────
-- This query extracts all post_timing_rules across primary + secondary moments
WITH all_moments AS (
  -- Primary moment
  SELECT 
    'primary' AS moment_type,
    revenue_drivers -> 'primary_revenue_moment' ->> 'moment_id' AS moment_id,
    revenue_drivers -> 'primary_revenue_moment' -> 'post_timing_rules' AS timing_rules
  FROM business_brand_profile
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND revenue_drivers IS NOT NULL
  
  UNION ALL
  
  -- Secondary moments
  SELECT 
    'secondary' AS moment_type,
    moment ->> 'moment_id' AS moment_id,
    moment -> 'post_timing_rules' AS timing_rules
  FROM business_brand_profile,
    jsonb_array_elements(revenue_drivers -> 'secondary_revenue_moments') AS moment
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND revenue_drivers IS NOT NULL
)
SELECT 
  moment_type,
  moment_id,
  rule ->> 'timing' AS timing,
  rule ->> 'purpose' AS purpose,
  rule ->> 'priority' AS priority
FROM all_moments,
  jsonb_array_elements(timing_rules) AS rule
ORDER BY 
  CASE moment_type WHEN 'primary' THEN 1 ELSE 2 END,
  moment_id,
  CASE rule ->> 'priority' 
    WHEN 'required' THEN 1 
    WHEN 'recommended' THEN 2 
    ELSE 3 
  END;

-- ── 7. Expected Output Validation ─────────────────────
-- For Cafe Faust, we expect:
-- Primary: weekend_dinner_cocktails (Fri-Sat evenings)
-- Secondary: weekday_lunch, weekend_brunch, possibly late_night_bar
-- Preferred days: Should include Thu (weekend driver), Mon (brand), Wed (weekday), Sat (brunch)

-- Validate expected structure
SELECT 
  CASE 
    WHEN revenue_drivers IS NULL THEN 'FAIL - No revenue_drivers found'
    WHEN revenue_drivers -> 'confidence_score' IS NULL THEN 'FAIL - Missing confidence_score'
    WHEN (revenue_drivers ->> 'confidence_score')::int < 70 THEN 'WARNING - Low confidence (<70)'
    WHEN revenue_drivers -> 'primary_revenue_moment' IS NULL THEN 'FAIL - Missing primary_revenue_moment'
    WHEN jsonb_array_length(revenue_drivers -> 'secondary_revenue_moments') = 0 THEN 'WARNING - No secondary moments (expected at least 1 for hybrid)'
    WHEN revenue_drivers -> 'normal_week_strategy' IS NULL THEN 'FAIL - Missing normal_week_strategy'
    WHEN jsonb_array_length(revenue_drivers -> 'normal_week_strategy' -> 'preferred_days') < 3 THEN 'WARNING - Less than 3 preferred days'
    ELSE 'PASS - All required fields present'
  END AS validation_result,
  revenue_drivers ->> 'confidence_score' AS confidence_score,
  revenue_drivers -> 'primary_revenue_moment' ->> 'moment_id' AS primary_moment,
  jsonb_array_length(revenue_drivers -> 'secondary_revenue_moments') AS secondary_count,
  jsonb_array_length(revenue_drivers -> 'normal_week_strategy' -> 'preferred_days') AS preferred_days_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
