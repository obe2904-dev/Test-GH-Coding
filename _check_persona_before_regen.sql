-- Quick check: Does current persona still have old "Studerende" data?
SELECT 
  business_identity_persona LIKE '%Studerende%' as has_students_OLD,
  business_identity_persona LIKE '%Strategiske målgrupper%' as has_strategic_NEW,
  SUBSTRING(business_identity_persona, POSITION('målgrupper' IN business_identity_persona) - 50, 400) as relevant_section
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
