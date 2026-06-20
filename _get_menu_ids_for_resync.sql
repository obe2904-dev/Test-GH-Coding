-- Get menu_results_v2 IDs for Cafe Faust
-- Use these IDs to call menu-sync function

SELECT 
  id,
  created_at,
  url,
  service_period_name,
  CASE 
    WHEN structured_data::text LIKE '%COCKTAIL%' THEN 'Has cocktails'
    WHEN structured_data::text LIKE '%APÉRITIF%' THEN 'Has aperitif'
    ELSE 'No drinks detected'
  END as drinks_status
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
  AND structured_data IS NOT NULL
ORDER BY created_at DESC;

-- Next step: Call menu-sync Edge Function for each menu_result_id
-- This will reclassify COCKTAILS as "drinks" instead of "main"

/*
For each id above, call via curl or Supabase client:

POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/menu-sync
{
  "businessId": "f4679fa9-3120-4a59-9506-d059b010c34a",
  "forceResync": true
}

This will re-process ALL menus for Cafe Faust with new category detection.
*/
