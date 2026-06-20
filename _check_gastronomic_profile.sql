-- ============================================================================
-- CHECK GASTRONOMIC PROFILE FOR CAFÉ FAUST
-- ============================================================================
-- Verify the gastronomic_profile column is populated correctly
-- Run this in Supabase SQL Editor after running Regenerate

SELECT 
  b.name as business_name,
  bp.gastronomic_profile,
  bp.menu_overview_summary -> 'gastronomic_profile' as gastronomic_profile_jsonb,
  bp.menu_overview_summary -> 'cross_menu_summary' as cross_menu_summary,
  LENGTH(bp.gastronomic_profile) as profile_length,
  bp.updated_at
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE bp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected output:
-- - gastronomic_profile: "Mellemklasse casual dining med fokus på..." (1-2 sentences)
-- - gastronomic_profile_jsonb: Same value (stored in JSONB too)
-- - profile_length: ~100-200 characters
