-- Find where Café Faust data actually lives

-- Check if there's a legacy business_profile table with business_id column
SELECT 'business_profile with business_id' as source, business_id, short_description, long_description
FROM business_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 1;

-- Check if profiles table has the business data
SELECT 'profiles table' as source, *
FROM profiles
WHERE id = '04b868f4-7a8d-402c-a60a-d089bf9013e1'
LIMIT 1;

-- Check all columns in profiles table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if there's brand voice data anywhere
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%brand%' OR column_name LIKE '%voice%' OR column_name LIKE '%tone%'
ORDER BY table_name;
