-- ==========================================
-- DELETE ALL TEST DATA - START FROM ZERO
-- ==========================================
-- WARNING: This will delete ALL users and related data
-- Only run this in development/testing environments!
-- ==========================================

-- Step 1: Delete all business-related data (cascading will handle most, but being explicit)
DELETE FROM public.business_team_members;
DELETE FROM public.business_profile;
DELETE FROM public.business_locations;
DELETE FROM public.businesses;

-- Step 2: Delete all user data
DELETE FROM public.profiles;

-- Step 3: Delete auth users (this is the critical part)
-- NOTE: You need to be careful with auth.users as it's managed by Supabase Auth
-- This will remove all users from authentication
DELETE FROM auth.users;

-- ==========================================
-- VERIFICATION
-- ==========================================
-- Run these to verify everything is deleted:

-- Check businesses (should be 0)
-- SELECT COUNT(*) FROM public.businesses;

-- Check profiles (should be 0)
-- SELECT COUNT(*) FROM public.profiles;

-- Check auth users (should be 0)
-- SELECT COUNT(*) FROM auth.users;

-- ==========================================
-- WHAT WAS DELETED:
-- ==========================================
-- ✓ All business records
-- ✓ All business locations
-- ✓ All business profiles
-- ✓ All team member relationships
-- ✓ All user profiles
-- ✓ All auth users (accounts)
--
-- After running this, you can:
-- 1. Create fresh user accounts
-- 2. Test onboarding from scratch
-- 3. Verify the full flow works
-- ==========================================
