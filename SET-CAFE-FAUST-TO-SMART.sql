-- Update Cafe Faust to Smart tier for testing
UPDATE businesses 
SET plan = 'standardplus' 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Verify the change
SELECT 
  id,
  name,
  plan,
  ai_generations_today,
  ai_generations_this_month
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
