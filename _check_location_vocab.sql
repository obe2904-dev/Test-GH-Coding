-- Check Café Faust location vocabulary and hooks
SELECT 
  bbp.business_id,
  -- From business_location_intelligence
  bli.area_type,
  bli.neighborhood,
  bli.location_marketing_hooks,
  bli.local_location_reference,
  jsonb_pretty(bli.landmarks_nearby::jsonb) as landmarks_nearby,
  -- From tone_dna
  (bbp.brand_profile_v5->'tone_dna'->'location_driver'->>'primary_driver') as location_primary_driver,
  (bbp.brand_profile_v5->'tone_dna'->'location_driver'->'natural_vocabulary') as location_natural_vocab,
  (bbp.brand_profile_v5->'tone_dna'->'location_driver'->'avoid_vocabulary') as location_avoid_vocab,
  -- Category scores show city_centre is also high
  bli.category_scores
FROM business_brand_profile bbp
LEFT JOIN business_location_intelligence bli ON bbp.business_id = bli.business_id
WHERE bbp.business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
