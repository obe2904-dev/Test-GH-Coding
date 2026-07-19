-- Debug RLS Issues for menu_results_v2
-- Run this to diagnose why INSERT is being blocked

-- Step 1: Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'menu_results_v2';

-- Step 2: List all policies on menu_results_v2
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'menu_results_v2'
ORDER BY cmd, policyname;

-- Step 3: Check if current user owns the business
-- Replace '875cf323-23cd-4487-af31-892e6a307f84' with your actual business_id
SELECT 
  b.id as business_id,
  b.owner_id,
  auth.uid() as current_user_id,
  (b.owner_id = auth.uid()) as is_owner
FROM businesses b
WHERE b.id = '875cf323-23cd-4487-af31-892e6a307f84';

-- Step 4: Test the policy query directly
-- This should return the business_id if the policy allows access
SELECT id 
FROM businesses 
WHERE owner_id = auth.uid() 
  AND id = '875cf323-23cd-4487-af31-892e6a307f84';

-- Step 5: Check if there are any column-level constraints
SELECT
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'menu_results_v2'::regclass;
