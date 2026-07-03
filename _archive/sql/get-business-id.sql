-- Quick query to get your business info for testing
SELECT 
  id as business_id,
  name as business_name,
  owner_id,
  category,
  subscription_tier
FROM businesses 
ORDER BY created_at DESC 
LIMIT 1;
