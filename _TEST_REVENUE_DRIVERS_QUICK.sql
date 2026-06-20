-- ============================================================================
-- QUICK TEST: Run in Supabase Dashboard SQL Editor
-- ============================================================================
-- Purpose: Validate revenue_drivers are populated for Cafe Faust
-- Instructions: Copy this entire file and paste into Supabase SQL Editor

-- Test 1: Verify revenue_drivers structure
SELECT 
  'Test 1: Revenue Drivers Schema' as test_name,
  business_id,
  brand_profile_v5->'revenue_drivers'->'primary'->>'moment' as primary_driver,
  brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'->0->>'day' as primary_day,
  brand_profile_v5->'revenue_drivers'->'secondary'->'post_timing'->'recommended_posts'->0->>'day' as secondary_day,
  brand_profile_v5->'revenue_drivers'->'normal_week_strategy'->>'preferred_day_pattern' as preferred_days
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected: primary_driver = "weekend_dinner", primary_day = "Thursday", preferred_days = ["Monday", "Thursday", "Friday", "Saturday"]
