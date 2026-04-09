-- Get the full SELECT policy definition
SELECT 
  policyname,
  pg_get_expr(qual, 'businesses'::regclass) as full_qual_expression
FROM pg_policy
WHERE polname = 'Users can view their business'
  AND polrelid = 'businesses'::regclass;

-- Also check if the user has a business
SELECT 
  b.id as business_id,
  b.name,
  b.plan,
  b.owner_id,
  b.created_at,
  (SELECT COUNT(*) FROM business_team_members WHERE business_id = b.id) as team_members
FROM businesses b
WHERE b.owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Check if user exists in profiles
SELECT id, email, onboarding_completed 
FROM auth.users 
WHERE id = '79240eba-2651-445c-8d4c-aaead7d06d9e';
