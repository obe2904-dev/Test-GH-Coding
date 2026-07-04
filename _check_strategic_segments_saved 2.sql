-- Check if strategic_audience_segments was saved during regeneration
SELECT 
  business_id,
  strategic_audience_segments IS NOT NULL as has_strategic_segments,
  strategic_audience_segments->'primary'->>'name' as primary_name,
  strategic_audience_segments,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
