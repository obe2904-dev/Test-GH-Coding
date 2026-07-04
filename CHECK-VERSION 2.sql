-- Check when brand profile was generated and what version
SELECT 
  business_id,
  brand_profile_v5_version,
  brand_profile_v5_generated_at,
  EXTRACT(DAY FROM (NOW() - brand_profile_v5_generated_at)) as days_old,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence' IS NOT NULL 
    THEN 'V5.1 (has Layer 0)' 
    ELSE 'V5.0 (no Layer 0)' 
  END as version_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
