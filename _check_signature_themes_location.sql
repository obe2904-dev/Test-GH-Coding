-- Find where signature_themes is actually stored

-- Check menu_overview_summary table
SELECT 
  'menu_overview_summary' as source,
  jsonb_pretty(signature_themes) as signature_themes,
  gastronomic_profile
FROM menu_overview_summary
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check if it's at a different path in brand_profile_v5
SELECT 
  'brand_profile_v5 top level' as source,
  jsonb_object_keys(brand_profile_v5) as keys
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
