-- Check if Cafe Faust has business_character populated
SELECT 
  b.name,
  b.plan,
  b.created_at::DATE AS "Account created",
  CASE 
    WHEN bbp.business_character IS NOT NULL AND LENGTH(bbp.business_character) > 0 
    THEN '✅ Has AI-generated "Om os"'
    ELSE '❌ Empty (NO business context)'
  END AS status,
  LENGTH(bbp.business_character) AS char_count,
  bbp.business_character AS "Om os text"
FROM businesses b
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
