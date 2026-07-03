-- ============================================================================
-- FIX PROGRAMME DAYS TO REFLECT ACTUAL OPERATION
-- Current: All three programmes = Mon-Sun (incorrect)
-- Target:  FROKOST = Mon-Fri, Brunch = Sat-Sun, AFTEN = Mon-Sun
-- ============================================================================

-- Step 1: Fix programme days
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  jsonb_set(
    brand_profile_v5,
    '{layer_1_programmes,0,daysOfWeek}', 
    '["monday", "tuesday", "wednesday", "thursday", "friday"]'::jsonb  -- FROKOST: Mon-Fri (weekday lunch)
  ),
  '{layer_1_programmes,1,daysOfWeek}', 
  '["saturday", "sunday"]'::jsonb  -- Brunch: Sat-Sun (weekend brunch)
)
-- AFTEN (index 2) already correct: Mon-Sun
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Step 2: Trigger revenue driver re-analysis
-- (Run via Edge Function after UPDATE completes)
-- curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/analyze-revenue-drivers" \
--   -H "Content-Type: application/json" \
--   -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
--   -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "force_refresh": true}'

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check programme days after fix
SELECT 
  brand_profile_v5->'layer_1_programmes'->0->>'name' as prog_0_name,
  brand_profile_v5->'layer_1_programmes'->0->'daysOfWeek' as prog_0_days,
  brand_profile_v5->'layer_1_programmes'->1->>'name' as prog_1_name,
  brand_profile_v5->'layer_1_programmes'->1->'daysOfWeek' as prog_1_days,
  brand_profile_v5->'layer_1_programmes'->2->>'name' as prog_2_name,
  brand_profile_v5->'layer_1_programmes'->2->'daysOfWeek' as prog_2_days
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check revenue drivers after re-analysis
SELECT 
  business_id,
  -- Check BOTH possible locations
  revenue_drivers IS NOT NULL as has_revenue_drivers_column,
  brand_profile_v5->'revenue_drivers' IS NOT NULL as has_revenue_drivers_in_v5,
  
  -- If in standalone column:
  jsonb_array_length(revenue_drivers->'primary_revenue_moments') as primary_count_column,
  revenue_drivers->'primary_revenue_moments'->0->>'label' as primary_1_label,
  revenue_drivers->'primary_revenue_moments'->1->>'label' as primary_2_label,
  revenue_drivers->'primary_revenue_moments'->2->>'label' as primary_3_label,
  jsonb_array_length(revenue_drivers->'secondary_revenue_moments') as secondary_count,
  revenue_drivers->'preferred_day_pattern' as preferred_days,
  
  -- Show full data for debugging
  jsonb_pretty(revenue_drivers) as revenue_drivers_full
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
