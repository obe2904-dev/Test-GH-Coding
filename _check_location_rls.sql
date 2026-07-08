-- Check RLS policies for business_location_intelligence table

SELECT 
  polname AS policy_name,
  polcmd AS command,
  polpermissive AS permissive,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
WHERE polrelid = 'business_location_intelligence'::regclass
ORDER BY polname;

-- Also check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'business_location_intelligence';
