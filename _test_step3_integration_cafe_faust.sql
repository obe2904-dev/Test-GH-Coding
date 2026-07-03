-- =====================================================
-- Test Step 3 Integration: Verify Business Rules Engine Active in Phase 1
-- Business: Cafe Faust
-- Date: 2026-06-07
-- =====================================================

-- Step 1: Verify revenue_drivers exist
SELECT 
  business_id,
  business_character,
  revenue_drivers->>'analyzed_at' as analyzed_at,
  revenue_drivers->>'analyzed_from' as analyzed_from,
  revenue_drivers->>'confidence_score' as confidence_score,
  revenue_drivers->'primary_revenue_moment'->>'service_type' as primary_service,
  revenue_drivers->'primary_revenue_moment'->>'importance' as primary_importance,
  jsonb_array_length(revenue_drivers->'secondary_revenue_moments') as secondary_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Step 2: Check expected slot generation logic
-- For Cafe Faust, we expect:
--   Slot A: Primary (FROKOST) → same_day 08:00-10:00
--   Slot B: First secondary (AFTEN) → Thursday 14:00
--   Slot C: Brand builder → Monday 09:00
--   Slot D: Second secondary (Brunch) → Wednesday 11:00

SELECT 
  'Expected Slot A (FROKOST)' as slot,
  'drive_footfall' as goal_mode,
  'product_menu' as content_category,
  'same_day 08:00-10:00' as timing_window,
  'Primary revenue moment with same-day timing rules' as reasoning
UNION ALL
SELECT 
  'Expected Slot B (AFTEN)' as slot,
  'drive_footfall' as goal_mode,
  'product_menu' as content_category,
  'Thursday 14:00' as timing_window,
  'First secondary (dinner) with required Thursday timing for weekend bookings' as reasoning
UNION ALL
SELECT 
  'Expected Slot C (Brand)' as slot,
  'build_brand' as goal_mode,
  'behind_scenes' as content_category,
  'Monday 09:00' as timing_window,
  'Always Monday 09:00 for brand awareness' as reasoning
UNION ALL
SELECT 
  'Expected Slot D (Brunch)' as slot,
  'retain_loyalty' as goal_mode,
  'craving_visual' as content_category,
  'Wednesday 11:00' as timing_window,
  'Second secondary (brunch) with recommended Wednesday timing' as reasoning;

-- Step 3: Verify timing rules extracted from programmes
SELECT 
  jsonb_pretty(revenue_drivers->'primary_revenue_moment'->'post_timing_rules') as primary_timing_rules,
  jsonb_pretty(revenue_drivers->'secondary_revenue_moments'->0->'post_timing_rules') as secondary_1_timing_rules,
  jsonb_pretty(revenue_drivers->'secondary_revenue_moments'->1->'post_timing_rules') as secondary_2_timing_rules
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Step 4: Check normal week strategy
SELECT 
  jsonb_pretty(revenue_drivers->'normal_week_strategy') as normal_week_strategy
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
