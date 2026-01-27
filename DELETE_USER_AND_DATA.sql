-- DELETE USER AND ALL ASSOCIATED DATA
-- Use this to clean up test accounts and start fresh with a new cafe
-- 
-- INSTRUCTIONS:
-- 1. Find the user's email or ID you want to delete
-- 2. Replace 'user@example.com' with the actual email
-- 3. Run this in Supabase SQL Editor
-- 4. The user will be completely removed along with all their data

-- ============================================================
-- STEP 1: Find the user (run this first to get the user_id)
-- ============================================================

SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'user@example.com';  -- REPLACE WITH ACTUAL EMAIL

-- ============================================================
-- STEP 2: Delete all associated data (use the user_id from above)
-- ============================================================

-- Set the user_id variable (replace with actual ID)
DO $$
DECLARE
  target_user_id uuid := 'PASTE-USER-ID-HERE';  -- REPLACE WITH ACTUAL USER ID
  business_id_to_delete uuid;
BEGIN
  -- Get the business_id for this user
  SELECT id INTO business_id_to_delete
  FROM business_profile
  WHERE user_id = target_user_id;

  RAISE NOTICE 'Deleting data for user: %', target_user_id;
  RAISE NOTICE 'Business ID: %', business_id_to_delete;

  -- Delete from business_profile (will cascade to most related tables)
  DELETE FROM business_profile WHERE user_id = target_user_id;
  RAISE NOTICE '✓ Deleted business_profile';

  -- Delete from user_profile
  DELETE FROM user_profile WHERE id = target_user_id;
  RAISE NOTICE '✓ Deleted user_profile';

  -- Delete any orphaned records (shouldn't exist with CASCADE, but just in case)
  
  -- Delete social media posts
  DELETE FROM social_media_posts WHERE business_id = business_id_to_delete;
  RAISE NOTICE '✓ Deleted social_media_posts';

  -- Delete business hours
  DELETE FROM business_hours WHERE business_id = business_id_to_delete;
  RAISE NOTICE '✓ Deleted business_hours';

  -- Delete any uploaded files from storage (optional - uncomment if needed)
  -- DELETE FROM storage.objects WHERE bucket_id = 'business-logos' AND owner = target_user_id;
  -- DELETE FROM storage.objects WHERE bucket_id = 'business-photos' AND owner = target_user_id;
  -- RAISE NOTICE '✓ Deleted storage objects';

  RAISE NOTICE '✓ All data deleted for user';
END $$;

-- ============================================================
-- STEP 3: Delete the user from auth.users
-- ============================================================

-- Delete from auth (this will also trigger any remaining cascades)
DELETE FROM auth.users 
WHERE email = 'user@example.com';  -- REPLACE WITH ACTUAL EMAIL

-- ============================================================
-- VERIFICATION: Check that user is gone
-- ============================================================

SELECT 
  'Users with this email' as check_type,
  COUNT(*) as count
FROM auth.users
WHERE email = 'user@example.com'  -- REPLACE WITH ACTUAL EMAIL

UNION ALL

SELECT 
  'Business profiles for this user' as check_type,
  COUNT(*) as count
FROM business_profile
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'user@example.com'  -- REPLACE WITH ACTUAL EMAIL
)

UNION ALL

SELECT 
  'User profiles for this user' as check_type,
  COUNT(*) as count
FROM user_profile
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'user@example.com'  -- REPLACE WITH ACTUAL EMAIL
);

-- Expected result: All counts should be 0


-- ============================================================
-- ALTERNATIVE: Simple one-step delete (if cascades are working)
-- ============================================================

-- If your database has proper CASCADE relationships set up,
-- you can just delete from auth.users and everything else will cascade:
-- 
-- DELETE FROM auth.users WHERE email = 'user@example.com';
-- 
-- This should automatically delete:
-- - user_profile (ON DELETE CASCADE)
-- - business_profile (ON DELETE CASCADE)
-- - business_hours (cascades from business_profile)
-- - social_media_posts (cascades from business_profile)
-- - And any other related records


-- ============================================================
-- QUICK DELETE BY EMAIL (copy-paste ready)
-- ============================================================

-- Just replace the email and run this single line:
DELETE FROM auth.users WHERE email = 'REPLACE-WITH-ACTUAL-EMAIL';
