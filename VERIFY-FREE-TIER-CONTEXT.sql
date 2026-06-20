-- =====================================================
-- VERIFY FREE TIER BUSINESS CONTEXT
-- =====================================================
-- Confirms that "Om os" (business_character) is available
-- for Free tier text generation

-- ── 1. Check business tier and character ──
SELECT 
  b.id,
  b.name,
  b.plan AS tier,
  bbp.business_character AS "Om os text",
  CASE 
    WHEN bbp.business_character IS NOT NULL AND LENGTH(bbp.business_character) > 0 
    THEN '✅ Has context'
    ELSE '❌ Missing context'
  END AS status
FROM businesses b
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ── 2. Character length (should be meaningful) ──
SELECT 
  LENGTH(business_character) AS "Character count",
  CASE 
    WHEN LENGTH(business_character) >= 50 THEN '✅ Sufficient detail'
    WHEN LENGTH(business_character) >= 20 THEN '⚠️  Minimal detail'
    ELSE '❌ Too short'
  END AS quality_check
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ── 3. Preview the "Om os" content ──
SELECT 
  business_character AS "Full Om os text"
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
