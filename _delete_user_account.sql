-- Delete user account and all associated data
-- User: olebaek@icloud.com
-- User ID: 14138811-5c34-40d6-ad51-94abe82e6a4b

-- WARNING: This will permanently delete ALL data for this user!
-- Run this in Supabase SQL Editor only if you're sure.

BEGIN;

-- Delete from users table (application data)
DELETE FROM users WHERE id = '14138811-5c34-40d6-ad51-94abe82e6a4b';

-- Delete from auth.users table (authentication)
DELETE FROM auth.users WHERE email = 'olebaek@icloud.com';

-- Verify deletion
SELECT 
  'Users table' as source,
  COUNT(*) as remaining_records
FROM users 
WHERE id = '14138811-5c34-40d6-ad51-94abe82e6a4b'
UNION ALL
SELECT 
  'Auth table' as source,
  COUNT(*) as remaining_records
FROM auth.users 
WHERE email = 'olebaek@icloud.com';

COMMIT;
