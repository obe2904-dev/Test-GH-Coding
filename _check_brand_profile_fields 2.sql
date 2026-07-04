-- Check what Cafe Faust actually has in brand profile
SELECT 
  business_id,
  brand_essence_elaboration,
  LEFT(CAST(v5 AS TEXT), 200) as v5_preview
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
