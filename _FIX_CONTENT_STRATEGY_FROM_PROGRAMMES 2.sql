-- ============================================================================
-- FIX CONTENT STRATEGY - Regenerate from existing programme data
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Issue: content_strategy is NULL, causing fallback message in UI
-- Solution: Calculate average from business_programme_profiles and update
-- ============================================================================

-- Step 1: Calculate the aggregated content strategy
WITH programme_stats AS (
  SELECT 
    COUNT(*) as programme_count,
    AVG((baseline_goal_split->>'drive_footfall')::int) as avg_drive_footfall,
    AVG((baseline_goal_split->>'strengthen_brand')::int) as avg_strengthen_brand,
    AVG((baseline_goal_split->>'retain_regulars')::int) as avg_retain_regulars
  FROM business_programme_profiles
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND baseline_goal_split IS NOT NULL
),
normalized_goals AS (
  SELECT 
    programme_count,
    ROUND(avg_drive_footfall) as drive_footfall,
    ROUND(avg_strengthen_brand) as build_brand,  -- Map to new name
    ROUND(avg_retain_regulars) as retain_loyalty  -- Map to new name
  FROM programme_stats
),
primary_goal_calc AS (
  SELECT 
    *,
    CASE 
      WHEN drive_footfall >= 45 THEN 'drive_footfall'
      WHEN build_brand >= 45 THEN 'build_brand'
      WHEN retain_loyalty >= 45 THEN 'retain_loyalty'
      ELSE 'drive_footfall'
    END as primary_goal
  FROM normalized_goals
)
SELECT 
  programme_count,
  jsonb_build_object(
    'goal_blend', jsonb_build_object(
      'drive_footfall', drive_footfall,
      'build_brand', build_brand,
      'retain_loyalty', retain_loyalty
    ),
    'content_category_weights', jsonb_build_object(
      'product_menu', 30,
      'craving_visual', 30,
      'behind_scenes', 25,
      'team_people', 15
    ),
    'primary_goal', primary_goal,
    'source', programme_count || ' programmes',
    'footfall_signals', jsonb_build_array('daglig trafik'),
    'brand_anchors', jsonb_build_array('kvalitet og håndværk'),
    'loyalty_hooks', jsonb_build_array('fast ugentligt besøg')
  ) as calculated_content_strategy
FROM primary_goal_calc;

-- Step 2: Update business_brand_profile with the calculated strategy
-- NOTE: Copy the JSONB output from Step 1 and use it in the UPDATE below

WITH programme_stats AS (
  SELECT 
    COUNT(*) as programme_count,
    AVG((baseline_goal_split->>'drive_footfall')::int) as avg_drive_footfall,
    AVG((baseline_goal_split->>'strengthen_brand')::int) as avg_strengthen_brand,
    AVG((baseline_goal_split->>'retain_regulars')::int) as avg_retain_regulars
  FROM business_programme_profiles
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND baseline_goal_split IS NOT NULL
),
normalized_goals AS (
  SELECT 
    programme_count,
    ROUND(avg_drive_footfall) as drive_footfall,
    ROUND(avg_strengthen_brand) as build_brand,
    ROUND(avg_retain_regulars) as retain_loyalty
  FROM programme_stats
),
primary_goal_calc AS (
  SELECT 
    *,
    CASE 
      WHEN drive_footfall >= 45 THEN 'drive_footfall'
      WHEN build_brand >= 45 THEN 'build_brand'
      WHEN retain_loyalty >= 45 THEN 'retain_loyalty'
      ELSE 'drive_footfall'
    END as primary_goal
  FROM normalized_goals
)
UPDATE business_brand_profile
SET 
  content_strategy = jsonb_build_object(
    'goal_blend', jsonb_build_object(
      'drive_footfall', (SELECT drive_footfall FROM primary_goal_calc),
      'build_brand', (SELECT build_brand FROM primary_goal_calc),
      'retain_loyalty', (SELECT retain_loyalty FROM primary_goal_calc)
    ),
    'content_category_weights', jsonb_build_object(
      'product_menu', 30,
      'craving_visual', 30,
      'behind_scenes', 25,
      'team_people', 15
    ),
    'primary_goal', (SELECT primary_goal FROM primary_goal_calc),
    'source', (SELECT programme_count || ' programmes' FROM primary_goal_calc),
    'footfall_signals', jsonb_build_array('daglig trafik'),
    'brand_anchors', jsonb_build_array('kvalitet og håndværk'),
    'loyalty_hooks', jsonb_build_array('fast ugentligt besøg')
  ),
  updated_at = NOW()
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Step 3: Verify the update
SELECT 
  business_id,
  content_strategy->'goal_blend' as goal_blend,
  content_strategy->'primary_goal' as primary_goal,
  content_strategy->'source' as source,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- VERIFICATION:
-- ============================================================================
-- After running this, the UI should no longer show:
-- "Ingen baseline content strategy fundet — standardfordeling anvendt."
--
-- Instead it should use the calculated averages from your 3 programmes
-- ============================================================================
