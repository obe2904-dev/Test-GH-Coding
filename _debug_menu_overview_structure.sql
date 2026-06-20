-- Debug: Check FULL menu_overview_summary structure
-- The persona generator expects specific fields that might be missing

SELECT 
  'MENU OVERVIEW SUMMARY (JSONB)' as check_type,
  
  -- Check what fields exist in the JSONB
  jsonb_object_keys(menu_overview_summary) as available_keys
  
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
AND menu_overview_summary IS NOT NULL;

-- Show the full structure
SELECT 
  'FULL STRUCTURE' as check_type,
  menu_overview_summary,
  
  -- Extract expected fields
  menu_overview_summary->>'cross_menu_summary' as has_cross_menu_summary,
  menu_overview_summary->'signature_themes' as has_signature_themes,
  menu_overview_summary->>'total_items' as has_total_items,
  menu_overview_summary->>'total_menus' as has_total_menus,
  menu_overview_summary->>'overall_avg_price' as has_overall_avg_price,
  menu_overview_summary->>'gastronomic_profile' as has_gastronomic_profile_in_jsonb,
  menu_overview_summary->'menu_breakdown' as has_menu_breakdown,
  menu_overview_summary->>'generated_at' as has_generated_at
  
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
