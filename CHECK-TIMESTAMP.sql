-- Check when programme profiles were last updated
-- This will show if we're looking at fresh or stale data

SELECT 
  programme_type,
  LEFT(commercial_reasoning, 100) as reasoning_start,
  created_at,
  updated_at,
  NOW() - updated_at as age
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY updated_at DESC;

-- If updated_at is recent (last few minutes), the data is fresh
-- If it's old, we're looking at stale data from before the fix
