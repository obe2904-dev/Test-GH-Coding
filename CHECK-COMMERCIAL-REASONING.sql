-- Check if commercial_reasoning was saved for Café Faust programmes
-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

SELECT 
  programme_type,
  baseline_goal_split,
  LEFT(commercial_reasoning, 200) as reasoning_preview,
  LENGTH(commercial_reasoning) as reasoning_length
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY programme_type;

-- Expected: All 4 programmes should have commercial_reasoning populated
-- The reasoning should mention "høj konkurrence" or "16" (competitors)
