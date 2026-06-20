-- Check: What programmes are actually detected for Café Faust?
-- Run in Supabase SQL Editor

SELECT 
  b.name,
  bpp.programme_type,
  bpp.programme_name,
  bpp.time_windows,
  bpp.operating_days,
  bpp.created_at
FROM business_programme_profiles bpp
JOIN businesses b ON b.id = bpp.business_id
WHERE bpp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY bpp.programme_type;
