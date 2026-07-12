-- Check what was extracted for Souk Aarhus after cookie consent fix
-- Latest Business ID: 450c1b6a-e354-4eef-88d8-86cd2ac8d42b (created 2026-07-11)
-- Old Business ID: 16c0d97d-8f02-4be8-8636-798a7f314db9

SELECT 
  b.name,
  b.website_url,
  b.logo_url,
  bp.long_description,
  bp.user_about_text,
  bp.ai_place_synopsis,
  jsonb_pretty(bp.menu_signal) as menu_signal,
  bp.key_offerings,
  wa.raw_result->>'businessName' as extracted_name,
  wa.raw_result->>'businessTypeLabel' as extracted_type,
  wa.raw_result->>'shortDescription' as extracted_description,
  LENGTH(wa.raw_result::text) as raw_result_size
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN website_analyses wa ON b.id = wa.business_id
WHERE b.id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b'
LIMIT 1;
