-- ============================================================================
-- VIEW PURE FACTS PERSONA FOR CAFÉ FAUST
-- ============================================================================
-- Run this in Supabase SQL Editor to see the generated persona
-- https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

SELECT 
  b.name as business_name,
  bp.brand_profile_v5 -> 'layer_0_intelligence' -> 'business_identity' ->> 'system_persona' as persona_text,
  bp.brand_profile_v5 -> 'layer_0_intelligence' -> 'business_identity' -> 'metadata' as metadata
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE bp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected output:
-- - business_name: Cafe Faust
-- - persona_text: "Du er Marketing ekspert for Cafe Faust. FORRETNING: [Om Os verbatim] NØGLEOPLYSNINGER: [3-5 facts]"
-- - metadata: {"word_count": ~100, "om_os_length": X, "menu_summaries_count": Y, "extracted_facts_count": 3-5}
