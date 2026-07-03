-- Check if business_audience_profile table exists and has data for Café Faust

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_audience_profile'
ORDER BY ordinal_position;

-- Check if Café Faust has segments
SELECT 
  business_id,
  audience_breadth,
  business_model_type,
  segments,
  created_at
FROM business_audience_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- If no data exists, we'll need to create sample segments for testing
