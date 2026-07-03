-- DIAGNOSTIC: Check business_locations table structure and data

-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'business_locations'
) as table_exists;

-- Check columns in business_locations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'business_locations'
ORDER BY ordinal_position;

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'business_locations';

-- Check existing policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'business_locations';

-- Check if there's any data (bypassing RLS by using postgres role)
SELECT COUNT(*) as total_rows
FROM public.business_locations;

-- Check recent business_locations for your business
SELECT bl.id, bl.business_id, bl.postal_code, bl.city, bl.country, bl.created_at,
       b.owner_id, b.name as business_name
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
ORDER BY bl.created_at DESC
LIMIT 5;
