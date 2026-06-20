-- ============================================================================
-- VERIFY SIGNATURE THEMES STORAGE
-- ============================================================================
-- Check both separate column and JSONB field for signature themes
-- ============================================================================

SELECT 
  business_id,
  
  -- Separate column (new)
  signature_themes AS themes_column,
  
  -- JSONB field (existing)
  menu_overview_summary->'signature_themes' AS themes_jsonb,
  
  -- Array length comparison
  CASE 
    WHEN signature_themes IS NOT NULL THEN array_length(signature_themes, 1)
    ELSE 0
  END AS column_count,
  
  CASE 
    WHEN menu_overview_summary->'signature_themes' IS NOT NULL 
    THEN jsonb_array_length(menu_overview_summary->'signature_themes')
    ELSE 0
  END AS jsonb_count,
  
  updated_at
  
FROM business_brand_profile

WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'  -- Café Faust

ORDER BY updated_at DESC
LIMIT 1;
