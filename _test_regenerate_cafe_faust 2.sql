-- ═══════════════════════════════════════════════════════════════════════════
-- TEST: Regenerate Cafe Faust Brand Profile
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Verify business_identity_persona now uses strategic_audience_segments
-- Expected: Should show "Strategiske målgrupper:" instead of "Studerende (88 score)"

-- 1. Check BEFORE regeneration
SELECT 
  business_id,
  LENGTH(business_identity_persona) as persona_length,
  business_identity_persona LIKE '%Studerende%' as has_students_old,
  business_identity_persona LIKE '%Strategiske målgrupper%' as has_strategic_new,
  SUBSTRING(business_identity_persona, 1, 500) as persona_preview
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Trigger regeneration via edge function
-- Run this in your app or via curl:
/*
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a"}'
*/

-- 3. Check AFTER regeneration (run this after step 2)
SELECT 
  business_id,
  LENGTH(business_identity_persona) as persona_length,
  business_identity_persona LIKE '%Studerende%' as has_students_old,
  business_identity_persona LIKE '%Strategiske målgrupper%' as has_strategic_new,
  business_identity_persona LIKE '%Aftensmad ved åen%' as has_primary_segment,
  business_identity_persona LIKE '%Brunchentusiaster%' as has_secondary_segment,
  business_identity_persona as full_persona
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Extract just the audience section
SELECT 
  business_id,
  SUBSTRING(
    business_identity_persona 
    FROM 'Strategiske målgrupper:(.*?)(?:###|$)'
  ) as audience_section
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
