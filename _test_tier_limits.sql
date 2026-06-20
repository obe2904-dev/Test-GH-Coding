-- Test 1: Check current state
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a', CURRENT_DATE);

-- Test 2: Check regeneration limit for each tier
UPDATE businesses SET plan = 'free' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
SELECT 'Free tier' as tier, regenerations_limit FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a', CURRENT_DATE);

UPDATE businesses SET plan = 'standardplus' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
SELECT 'Smart tier' as tier, regenerations_limit FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a', CURRENT_DATE);

UPDATE businesses SET plan = 'premium' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
SELECT 'Pro tier' as tier, regenerations_limit FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a', CURRENT_DATE);

-- Reset to free
UPDATE businesses SET plan = 'free' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
