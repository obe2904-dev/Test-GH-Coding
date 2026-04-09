-- ========================================
-- LAYER 2: CONTENT TYPE DISTRIBUTION VERIFICATION
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- ========================================

-- Layer 2 determines:
-- 1. How many posts per week (based on category)
-- 2. What content types (menu_item, atmosphere, engagement, etc.)
-- 3. Mix percentages

-- Q1: Check if custom distribution exists in database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%distribution%' OR table_name LIKE '%content_type%'
ORDER BY table_name;

-- Q2: Check business settings for post frequency
SELECT 
  id,
  name,
  category,
  selected_platforms
FROM businesses 
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Q4: Check content_distribution_rules table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_distribution_rules'
ORDER BY ordinal_position;

-- Q5: Check content_type_baselines structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_type_baselines'
ORDER BY ordinal_position;

-- Q6: Check content_types table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_types'
ORDER BY ordinal_position;

-- Q7: Get ALL content_types (these are the available post types)
SELECT 
  id,
  display_name,
  instagram_priority,
  facebook_priority,
  max_frequency_per_week
FROM content_types
ORDER BY instagram_priority DESC;

-- Q8: Get distribution rules for 'cafe' business type
-- This should show us the 7 posts/week allocation
SELECT 
  business_type,
  content_type_id,
  baseline_percentage,
  posts_per_week,
  priority,
  min_days_between,
  rationale
FROM content_distribution_rules
WHERE business_type = 'cafe'
ORDER BY priority;

-- Q9: Check if Café Faust has custom distribution
SELECT 
  business_type,
  content_type_id,
  baseline_percentage,
  posts_per_week,
  priority
FROM content_distribution_rules
WHERE business_type = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY priority;

-- Q10: Check if Café Faust has historical performance baselines
SELECT 
  business_id,
  total_posts_analyzed,
  sufficient_data,
  last_calculated,
  baselines
FROM content_type_baselines
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Q11: Sum up the total posts_per_week for cafe to verify = 7
SELECT 
  business_type,
  SUM(posts_per_week) as total_weekly_posts,
  COUNT(*) as number_of_content_types
FROM content_distribution_rules
WHERE business_type = 'cafe'
GROUP BY business_type;

-- ========================================
-- LAYER 2 VERIFICATION RESULTS
-- ========================================
-- 
-- ✅ LAYER 2 COMPLETE
--
-- FINDINGS:
-- 1. NO database distribution rules for 'cafe' business type
-- 2. System uses HARDCODED defaults in opportunity-selector.ts line 282-290:
--    {
--      totalSlots: 7,
--      distribution: {
--        menu_item: 3,                  (requires menu items)
--        atmosphere_experience: 2,      (requires compound opportunities)
--        behind_the_scenes: 1,          (requires compound opportunities)
--        promotional: 1                 (requires compound opportunities)
--      }
--    }
--
-- 3. Café Faust has:
--    - 73 menu items (can fill 3 menu_item slots) ✅
--    - 0 compound opportunities (CANNOT fill 4 compound slots) ❌
--
-- 4. Result: 4/7 slots filled (3 menu + 1 fallback)
--    - System allocates 7 but only fills what it can
--
-- NEXT: Verify Layer 3 (why no compound opportunities generated)
-- ========================================
