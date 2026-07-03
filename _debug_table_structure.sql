-- Check actual columns in business_programme_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_programme_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
