-- Debug: View full marketing_manager_brief to see what's included
SELECT 
  business_id,
  marketing_manager_brief,
  LENGTH(marketing_manager_brief) as length,
  updated_at
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
