-- Check all data for this user
-- User ID: 04b868f4-7a8d-402c-a60a-d089bf9013e1

-- Simple query to check all related data at once
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.vertical,
  b.category,
  CASE WHEN bp.business_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_business_profile,
  CASE WHEN bbp.business_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_brand_profile,
  CASE WHEN bli.business_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_location_intel
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
LEFT JOIN business_location_intelligence bli ON bli.business_id = b.id
WHERE b.owner_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';
