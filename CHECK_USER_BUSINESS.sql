-- Check if user 79240eba-2651-445c-8d4c-aaead7d06d9e has a business
SELECT 
  b.id as business_id,
  b.name,
  b.plan,
  b.owner_id,
  b.created_at
FROM businesses b
WHERE b.owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Check RLS policies
SELECT 
  policyname, 
  roles::text,
  cmd,
  qual::text
FROM pg_policies 
WHERE tablename = 'businesses';
