-- Check FULL commercial_reasoning text for all programmes
-- Run this in Supabase Dashboard SQL Editor

SELECT 
  programme_type,
  baseline_goal_split,
  commercial_reasoning as full_reasoning
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY programme_type;

-- This will show the complete reasoning text so we can search for "høj konkurrence" or "16"
