-- Verify gastronomic_profile and signature_themes were properly populated
-- After menu-overview-summary update for business 64ece273-bca0-4410-8cf9-2678d8bfaf20

SELECT 
  business_id,
  gastronomic_profile,
  signature_themes,
  menu_overview_summary->>'total_items' as total_items,
  menu_overview_summary->>'total_menus' as total_menus,
  menu_overview_summary->>'overall_avg_price' as avg_price,
  updated_at
FROM business_brand_profile
WHERE business_id = '64ece273-bca0-4410-8cf9-2678d8bfaf20';
