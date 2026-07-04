-- Check if user has a business and their quota status
-- User ID from error log: 676d1e29-4d29-4072-8764-797593a278d9

SELECT 
  u.id as user_id,
  u.email,
  b.id as business_id,
  b.name as business_name,
  b.plan,
  b.ai_generations_today,
  b.ai_generations_this_month,
  CASE 
    WHEN b.id IS NULL THEN '❌ NO BUSINESS FOUND'
    WHEN b.plan IS NULL THEN '⚠️  Business exists but plan is NULL'
    ELSE '✅ Business setup complete'
  END as status
FROM auth.users u
LEFT JOIN businesses b ON b.owner_id = u.id
WHERE u.id = '676d1e29-4d29-4072-8764-797593a278d9';

-- Also check if they're a team member instead of owner
SELECT 
  btm.user_id,
  btm.business_id,
  btm.role,
  btm.accepted_at,
  b.name as business_name,
  b.plan
FROM business_team_members btm
JOIN businesses b ON b.id = btm.business_id
WHERE btm.user_id = '676d1e29-4d29-4072-8764-797593a278d9';
