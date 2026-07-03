-- Verification script for two-dimensional framework migration
-- Run this to verify the migration was successfully applied

\echo '======================================================================'
\echo 'VERIFICATION: Two-Dimensional Framework Migration'
\echo '======================================================================'

\echo ''
\echo '1. Check content_style column exists in posts table:'
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'posts' 
  AND column_name = 'content_style';

\echo ''
\echo '2. Check business_brand_profile has new tactical fields:'
SELECT 
  business_id,
  content_strategy->'tactical_capabilities' as tactical_capabilities,
  content_strategy->'tactical_focus' as tactical_focus,
  content_strategy->'content_balance' as content_balance
FROM business_brand_profile 
WHERE business_id = '8da404df-2654-4bfe-b118-24016d9b17f2';

\echo ''
\echo '3. Check sample angles from recent strategy for content_style:'
SELECT 
  id,
  status,
  angles->0->>'goal_mode' as angle_a_goal,
  angles->0->>'content_style' as angle_a_style,
  angles->1->>'goal_mode' as angle_b_goal,
  angles->1->>'content_style' as angle_b_style
FROM weekly_strategies 
WHERE business_id = '8da404df-2654-4bfe-b118-24016d9b17f2'
ORDER BY created_at DESC
LIMIT 1;

\echo ''
\echo '======================================================================'
\echo 'END VERIFICATION'
\echo '======================================================================'
