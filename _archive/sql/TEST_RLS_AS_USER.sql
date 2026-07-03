-- Test if the authenticated user can actually query their business
-- This simulates what happens in the app

-- First, verify the business exists
SELECT id, name, plan, owner_id 
FROM businesses 
WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Check if there's an issue with the plan column specifically
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'businesses' 
  AND column_name = 'plan';

-- Check if RLS is actually enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'businesses';

-- Try to see what error PostgreSQL is giving
-- We need to check the Supabase logs for the actual error
