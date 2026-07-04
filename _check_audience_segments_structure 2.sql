-- Check the actual structure of audience_segments in the database
SELECT 
  business_id,
  jsonb_pretty(audience_segments) as audience_segments_structure,
  jsonb_typeof(audience_segments->'segments') as segments_type,
  jsonb_array_length(COALESCE(audience_segments->'segments', '[]'::jsonb)) as segment_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
