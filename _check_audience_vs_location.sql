-- Check audience_segments vs location category_scores
SELECT 
  business_id,
  
  -- Audience segments (business-specific)
  audience_segments,
  
  -- Location intelligence (location data)
  brand_profile_v5->'identity'->'location_intelligence'->'category_scores' as location_scores,
  brand_profile_v5->'identity'->'location_intelligence'->>'is_strategy_driver' as strategy_driver

FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
