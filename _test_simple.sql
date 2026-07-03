-- Direct test of tier limits using CASE statement
SELECT 
  'free' as plan,
  CASE 'free' 
    WHEN 'standardplus' THEN 3
    WHEN 'premium' THEN 5
    ELSE 1
  END as regeneration_limit
  
UNION ALL

SELECT 
  'standardplus' as plan,
  CASE 'standardplus'
    WHEN 'standardplus' THEN 3
    WHEN 'premium' THEN 5
    ELSE 1
  END as regeneration_limit
  
UNION ALL

SELECT 
  'premium' as plan,
  CASE 'premium'
    WHEN 'standardplus' THEN 3
    WHEN 'premium' THEN 5
    ELSE 1
  END as regeneration_limit;

-- Test actual Cafe Faust stats
SELECT 
  'Cafe Faust Current Status' as test,
  *
FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a', CURRENT_DATE);
