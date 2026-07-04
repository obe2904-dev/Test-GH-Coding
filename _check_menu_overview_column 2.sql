-- Check if menu_overview_summary column has data

SELECT 
  business_id,
  menu_overview_summary IS NOT NULL as has_menu_overview,
  signature_themes IS NOT NULL as has_signature_themes,
  gastronomic_profile IS NOT NULL as has_gastronomic,
  jsonb_pretty(menu_overview_summary) as menu_overview_data
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
