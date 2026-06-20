-- =====================================================
-- VERIFY: DELETE policy was created successfully
-- =====================================================

-- Check all policies on published_posts (should now include DELETE)
SELECT 
  policyname,
  cmd AS operation,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Read'
    WHEN cmd = 'INSERT' THEN '✅ Create'
    WHEN cmd = 'UPDATE' THEN '✅ Update'
    WHEN cmd = 'DELETE' THEN '✅ Delete'
    ELSE cmd
  END AS action,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has restrictions'
    ELSE 'No restrictions'
  END AS policy_type
FROM pg_policies
WHERE tablename = 'published_posts'
ORDER BY cmd;
