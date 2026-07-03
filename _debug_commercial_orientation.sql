-- Debug: Check what's in the business_programme_profiles.commercial_orientation field
SELECT 
  programme_name,
  programme_type,
  commercial_orientation,
  jsonb_pretty(commercial_orientation) as commercial_orientation_pretty,
  commercial_orientation->'price_positioning' as price_pos,
  commercial_orientation->'price_positioning'->>'avg' as avg_value
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_name;
