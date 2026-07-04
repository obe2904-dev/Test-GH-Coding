-- Get actual schema for business_location_intelligence table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
ORDER BY ordinal_position;
