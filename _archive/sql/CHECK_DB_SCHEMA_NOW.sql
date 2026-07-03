-- Check business_profile columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'business_profile'
ORDER BY ordinal_position;

-- Check if the specific business exists
SELECT business_id, business_name, created_at
FROM business_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check RLS policies on business_profile
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'business_profile';
