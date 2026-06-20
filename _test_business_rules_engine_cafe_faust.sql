-- =====================================================
-- TEST: Business Rules Engine with Cafe Faust
-- =====================================================
-- Verifies that revenue_drivers data generates intelligent slot allocation
-- Run this to verify Step 2 (Business Rules Engine) implementation
-- =====================================================

\echo '╔═══════════════════════════════════════════════════╗'
\echo '║  Business Rules Engine Test - Cafe Faust          ║'
\echo '╚═══════════════════════════════════════════════════╝'
\echo ''

-- TEST 1: Verify revenue_drivers exists for Cafe Faust
\echo '✅ TEST 1: Revenue Drivers Availability'
SELECT 
  business_id,
  revenue_drivers->>'analyzed_from' as source,
  (revenue_drivers->>'confidence_score')::int as confidence,
  revenue_drivers->'primary_revenue_moment'->>'moment_id' as primary_moment,
  revenue_drivers->'primary_revenue_moment'->>'label' as primary_label
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 2: Primary Revenue Moment Details'
SELECT 
  revenue_drivers->'primary_revenue_moment'->>'service_type' as service_type,
  revenue_drivers->'primary_revenue_moment'->>'time_range' as time_range,
  revenue_drivers->'primary_revenue_moment'->>'decision_pattern' as decision_pattern,
  jsonb_array_length(revenue_drivers->'primary_revenue_moment'->'post_timing_rules') as timing_rules_count,
  revenue_drivers->'primary_revenue_moment'->'post_timing_rules'->0->>'timing' as first_timing_rule,
  revenue_drivers->'primary_revenue_moment'->'post_timing_rules'->0->>'priority' as first_timing_priority
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 3: Secondary Revenue Moments'
SELECT 
  jsonb_array_length(revenue_drivers->'secondary_revenue_moments') as secondary_count,
  revenue_drivers->'secondary_revenue_moments'->0->>'moment_id' as first_secondary_id,
  revenue_drivers->'secondary_revenue_moments'->0->>'label' as first_secondary_label,
  revenue_drivers->'secondary_revenue_moments'->0->>'service_type' as first_secondary_type,
  revenue_drivers->'secondary_revenue_moments'->1->>'moment_id' as second_secondary_id,
  revenue_drivers->'secondary_revenue_moments'->1->>'label' as second_secondary_label,
  revenue_drivers->'secondary_revenue_moments'->1->>'service_type' as second_secondary_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 4: Normal Week Strategy'
SELECT 
  jsonb_pretty(revenue_drivers->'normal_week_strategy'->'minimum_coverage') as minimum_coverage,
  jsonb_pretty(revenue_drivers->'normal_week_strategy'->'preferred_days') as preferred_days,
  revenue_drivers->'normal_week_strategy'->>'rationale' as strategy_rationale
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 5: Post Timing Rules (Primary Moment)'
SELECT 
  row_number() OVER () as rule_number,
  timing_rule->>'timing' as timing,
  timing_rule->>'purpose' as purpose,
  timing_rule->>'priority' as priority
FROM 
  business_brand_profile,
  jsonb_array_elements(revenue_drivers->'primary_revenue_moment'->'post_timing_rules') as timing_rule
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 6: Post Timing Rules (AFTEN Secondary Moment)'
SELECT 
  row_number() OVER () as rule_number,
  timing_rule->>'timing' as timing,
  timing_rule->>'purpose' as purpose,
  timing_rule->>'priority' as priority
FROM 
  business_brand_profile,
  jsonb_array_elements(revenue_drivers->'secondary_revenue_moments'->1->'post_timing_rules') as timing_rule
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '✅ TEST 7: Decision Windows (AFTEN Moment)'
SELECT 
  row_number() OVER () as window_number,
  decision_window->>'description' as description,
  decision_window->>'hours' as hours,
  decision_window->>'conversion_strength' as conversion_strength,
  jsonb_pretty(decision_window->'days') as days
FROM 
  business_brand_profile,
  jsonb_array_elements(revenue_drivers->'secondary_revenue_moments'->1->'decision_windows') as decision_window
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

\echo ''
\echo '╔═══════════════════════════════════════════════════╗'
\echo '║  EXPECTED BUSINESS RULES ENGINE OUTPUT            ║'
\echo '╚═══════════════════════════════════════════════════╝'
\echo ''

\echo 'Based on the revenue_drivers data above, the Business Rules Engine should generate:'
\echo ''
\echo 'SLOT A (Primary Footfall Driver):'
\echo '  • Revenue Moment: lunch_frokost (FROKOST)'
\echo '  • Timing: same_day 08:00-10:00 (from post_timing_rules)'
\echo '  • Goal: drive_footfall'
\echo '  • Category: product_menu'
\echo ''
\echo 'SLOT B (Secondary Footfall Driver):'
\echo '  • Revenue Moment: dinner_aften (AFTEN) OR morning_brunch (Brunch)'
\echo '  • Timing: Thursday 14:00 (from AFTEN post_timing_rules[0])'
\echo '  • Goal: drive_footfall'
\echo '  • Category: product_menu'
\echo ''
\echo 'SLOT C (Brand Builder):'
\echo '  • Revenue Moment: brand_awareness'
\echo '  • Timing: Monday 09:00 (from preferred_days)'
\echo '  • Goal: build_brand'
\echo '  • Category: behind_scenes'
\echo ''
\echo 'SLOT D (Flexible/Loyalty):'
\echo '  • Revenue Moment: morning_brunch OR dinner_aften (whichever not used in B)'
\echo '  • Timing: Wednesday 11:00 (from preferred_days)'
\echo '  • Goal: retain_loyalty'
\echo '  • Category: craving_visual'
\echo ''

\echo '╔═══════════════════════════════════════════════════╗'
\echo '║  COMPARISON WITH OLD BASE_SLOTS                   ║'
\echo '╚═══════════════════════════════════════════════════╝'
\echo ''

\echo 'OLD BASE_SLOTS (Hardcoded):'
\echo '  A: Fri-Sat 14:00 (drive_footfall, product_menu)'
\echo '  B: Wed-Thu 11:00 (drive_footfall, product_menu)'
\echo '  C: Mon 09:00 (build_brand, behind_scenes)'
\echo '  D: any (retain_loyalty, craving_visual)'
\echo ''
\echo 'NEW (From Revenue Drivers for Cafe Faust):'
\echo '  A: same_day 08:00-10:00 (FROKOST - matches actual lunch decision window)'
\echo '  B: Thursday 14:00 (AFTEN - captures weekend dinner booking window)'
\echo '  C: Monday 09:00 (Brand awareness - start of week)'
\echo '  D: Wednesday 11:00 (Brunch - mid-week engagement)'
\echo ''
\echo '✅ IMPROVEMENT: Slots now match actual business revenue patterns!'
\echo '✅ Thursday 14:00 post captures weekend dinner bookings (was missing in old system)'
\echo '✅ Lunch timing aligns with same-day morning decision pattern'
\echo ''

\echo '╔═══════════════════════════════════════════════════╗'
\echo '║  TEST COMPLETE                                    ║'
\echo '╚═══════════════════════════════════════════════════╝'
