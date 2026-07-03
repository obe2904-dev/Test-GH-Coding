-- Check what columns exist in business_operations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_operations'
ORDER BY ordinal_position;

-- Also check if reservation data is in business_profile instead
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_profile'
  AND column_name LIKE '%book%' OR column_name LIKE '%reserv%'
ORDER BY ordinal_position;
