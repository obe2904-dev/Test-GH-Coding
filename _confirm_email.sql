-- Manually confirm email for olebaek@icloud.com
-- Run this in Supabase SQL Editor

UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmation_token = NULL,
  confirmation_sent_at = NULL
WHERE email = 'olebaek@icloud.com';

-- Verify the update
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'olebaek@icloud.com';
