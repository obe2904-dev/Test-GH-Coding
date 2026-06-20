-- ============================================================================
-- CHECK MENU OVERVIEW (Cross-Menu Summary) - STANDALONE FEATURE
-- ============================================================================
-- This displays under "Programidentifikation" in Brand Profile
-- Shows complete offering overview across all menus
-- NOT related to persona or other features
-- ============================================================================

-- Display format for Brand Profile UI
SELECT 
  business_id,
  b.name || ' Complete Offering' as section_title,
  (brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_items') || ' total items across ' || 
    (brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_menus') || ' menus · Ø ' ||
    (brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'overall_avg_price') || ' DKK' as stats_line,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'cross_menu_summary' as cross_menu_summary,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->'signature_themes' as signature_themes,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'generated_at' as generated_at
FROM business_brand_profile bbp
LEFT JOIN businesses b ON bbp.business_id = b.id
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';  -- Café Faust

-- ============================================================================
-- Raw data check
-- ============================================================================
SELECT 
  business_id,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'cross_menu_summary' as cross_menu_summary,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_items' as total_items,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_menus' as total_menus,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'overall_avg_price' as overall_avg_price,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->'signature_themes' as signature_themes,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'generated_at' as generated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- Check menu breakdown details
-- ============================================================================
SELECT 
  business_id,
  jsonb_pretty(brand_profile_v5->'layer_0_intelligence'->'menu_overview'->'menu_breakdown') as menu_breakdown
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- Validate cross-menu summary exists for businesses with multiple menus
-- ============================================================================
SELECT 
  bbp.business_id,
  b.name as business_name,
  COUNT(DISTINCT mr.id) as menu_count,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'menu_overview' IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_cross_menu_summary,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_menus' as total_menus,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_items' as total_items
FROM business_brand_profile bbp
LEFT JOIN businesses b ON bbp.business_id = b.id
LEFT JOIN menu_results_v2 mr ON mr.business_id = bbp.business_id AND mr.status = 'done'
WHERE brand_profile_v5 IS NOT NULL
GROUP BY bbp.business_id, b.name, brand_profile_v5
HAVING COUNT(DISTINCT mr.id) >= 2
ORDER BY menu_count DESC
LIMIT 20;

-- ============================================================================
-- Full Layer 0 Intelligence Overview
-- ============================================================================
SELECT 
  jsonb_pretty(brand_profile_v5->'layer_0_intelligence') as layer_0_intelligence
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
