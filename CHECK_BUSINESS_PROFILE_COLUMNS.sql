-- Check what columns exist in business_profile table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_profile'
ORDER BY ordinal_position;
