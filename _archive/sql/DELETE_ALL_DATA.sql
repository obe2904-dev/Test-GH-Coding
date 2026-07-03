-- DELETE ALL USER DATA (Keep only auth accounts)
-- Use this to wipe all business data while keeping user accounts intact
-- Good for testing when you want to go through onboarding again with same email

-- ============================================================
-- STEP 0: CHECK WHAT TABLES EXIST (RUN THIS FIRST!)
-- ============================================================

-- See all tables in your database
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- OPTION 1: DELETE ALL DATA, KEEP USER ACCOUNTS
-- ============================================================

-- This deletes all business data but keeps the auth.users intact
-- so you can login with the same email and go through onboarding again

BEGIN;

-- Delete all business hours
DELETE FROM business_hours WHERE true;

-- Delete all business profiles (this might cascade to other tables)
DELETE FROM business_profile WHERE true;

-- Delete all user profiles
DELETE FROM user_profile WHERE true;

-- Try to delete posts table if it exists (might be named 'posts' not 'social_media_posts')
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    DELETE FROM posts;
    RAISE NOTICE '✓ Deleted from posts table';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_media_posts') THEN
    DELETE FROM social_media_posts;
    RAISE NOTICE '✓ Deleted from social_media_posts table';
  END IF;
END $$;

-- Verify everything is deleted
SELECT 
  'business_profile' as table_name, COUNT(*) as remaining_rows FROM business_profile
UNION ALL
SELECT 'user_profile', COUNT(*) FROM user_profile
UNION ALL
SELECT 'business_hours', COUNT(*) FROM business_hours
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

-- If verification looks good, commit:
COMMIT;

-- If something looks wrong, rollback:
-- ROLLBACK;


-- ============================================================
-- OPTION 2: DELETE EVERYTHING INCLUDING AUTH ACCOUNTS
-- ============================================================

-- This completely wipes the database - use to start 100% fresh
-- WARNING: You'll need to create new accounts after this

BEGIN;

-- Delete all data tables first
DELETE FROM business_hours WHERE true;
DELETE FROM business_profile WHERE true;
DELETE FROM user_profile WHERE true;

-- Try to delete posts if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    DELETE FROM posts;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_media_posts') THEN
    DELETE FROM social_media_posts;
  END IF;
END $$;

-- Delete all auth users (this removes login accounts)
DELETE FROM auth.users WHERE true;

-- Verify everything is deleted
SELECT 
  'business_profile' as table_name, COUNT(*) as remaining_rows FROM business_profile
UNION ALL
SELECT 'user_profile', COUNT(*) FROM user_profile
UNION ALL
SELECT 'business_hours', COUNT(*) FROM business_hours
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

-- All counts should be 0

-- If verification looks good, commit:
COMMIT;

-- If something looks wrong, rollback:
-- ROLLBACK;


-- ============================================================
-- OPTION 3: QUICK WIPE (if cascades work properly)
-- ============================================================

-- If your database has CASCADE set up correctly, just delete auth.users
-- and everything else will cascade automatically:

DELETE FROM auth.users;

-- This should automatically delete:
-- - user_profile (ON DELETE CASCADE)
-- - business_profile (ON DELETE CASCADE)
-- - business_hours (cascades from business_profile)
-- - social_media_posts (cascades from business_profile)


-- ============================================================
-- OPTION 4: RESET TO CLEAN SLATE (Keep structure, delete data)
-- ============================================================

-- Truncate tables (faster than DELETE for large datasets)
-- WARNING: This cannot be rolled back!

TRUNCATE TABLE business_hours CASCADE;
TRUNCATE TABLE business_profile CASCADE;
TRUNCATE TABLE user_profile CASCADE;

-- Try to truncate posts tables if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    EXECUTE 'TRUNCATE TABLE posts CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_media_posts') THEN
    EXECUTE 'TRUNCATE TABLE social_media_posts CASCADE';
  END IF;
END $$;

-- For auth.users, use DELETE instead of TRUNCATE (TRUNCATE not allowed on auth schema)
DELETE FROM auth.users WHERE true;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check what data currently exists
SELECT 'auth.users' as table_name, 
       COUNT(*) as total_rows,
       string_agg(email, ', ') as emails
FROM auth.users
GROUP BY table_name

UNION ALL

SELECT 'business_profile',
       COUNT(*),
       string_agg(name, ', ')
FROM business_profile
GROUP BY table_name

UNION ALL

SELECT 'social_media_posts',
       COUNT(*),
       NULL
FROM social_media_posts
GROUP BY table_name;


-- ============================================================
-- RECOMMENDED: SIMPLE CLEAN WIPE (Start Fresh)
-- ============================================================

-- For your use case (2 test users, want to test onboarding again):
-- This keeps your login emails but wipes all business data

BEGIN;

-- Delete in order (most dependent first)
DELETE FROM business_hours WHERE true;
DELETE FROM business_profile WHERE true;
DELETE FROM user_profile WHERE true;

-- Check results
SELECT 
  'Data deleted' as status,
  (SELECT COUNT(*) FROM business_profile) as businesses,
  (SELECT COUNT(*) FROM user_profile) as profiles,
  (SELECT COUNT(*) FROM business_hours) as hours,
  (SELECT COUNT(*) FROM auth.users) as users_remaining;

COMMIT;

-- Now you can login with same email and go through onboarding fresh!
