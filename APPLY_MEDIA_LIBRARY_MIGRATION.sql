-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Media Library - Phase 1 Backend Infrastructure
-- Date: 2026-06-10
-- Related: _MEDIA_GALLERY_IMPLEMENTATION_PLAN.md
--
-- HOW TO APPLY:
-- 1. Go to: Supabase Dashboard → SQL Editor → New Query
-- 2. Copy-paste the migration file: supabase/migrations/20260610000001_create_media_library.sql
-- 3. Click "Run" button
-- 4. Verify success (should show "Success. No rows returned")
--
-- AFTER MIGRATION: Complete storage bucket setup (see below)
--
-- =====================================================

-- This file is a reference - the actual migration is in:
-- supabase/migrations/20260610000001_create_media_library.sql

-- =====================================================
-- PHASE 1 SETUP CHECKLIST
-- =====================================================

-- [ ] STEP 1: Run Migration
--     Location: Supabase Dashboard → SQL Editor
--     File: supabase/migrations/20260610000001_create_media_library.sql
--     Expected: Table 'media_library' created with indexes, RLS, and functions

-- [ ] STEP 2: Create Storage Bucket
--     Location: Supabase Dashboard → Storage → Create Bucket
--     Name: user-media
--     Public: YES (for CDN access)
--     File Size Limit: 10 MB
--     Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/webm

-- [ ] STEP 3: Add Storage Policies
--     Location: Supabase Dashboard → Storage → user-media → Policies
--     See: supabase/STORAGE_SETUP_user-media.md (section 3)
--     Add all 4 policies:
--       1. Authenticated Upload (users can upload to own business folder)
--       2. Public Read Access (anyone can view via CDN URL)
--       3. Authenticated Update (users can update own files)
--       4. Authenticated Delete (users can delete own files)

-- [ ] STEP 4: Test the Setup
--     1. Check table exists: SELECT * FROM media_library LIMIT 1;
--     2. Check function exists: SELECT increment_media_usage('00000000-0000-0000-0000-000000000000');
--     3. Check storage bucket: Go to Storage → user-media (should exist)
--     4. Test upload: Upload test image via Storage UI

-- [ ] STEP 5: Verify RLS Policies
--     Run this query to confirm all policies are active:

SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'media_library'
ORDER BY policyname;

-- Expected result: 3 policies
--   - Users can view own media (SELECT)
--   - Users can insert own media (INSERT)
--   - Users can update own media (UPDATE)

-- [ ] STEP 6: Verify Storage Policies
--     Run this query to confirm storage policies:

SELECT 
  name AS policy_name,
  definition
FROM storage.policies
WHERE bucket_id = 'user-media'
ORDER BY name;

-- Expected result: 4 policies
--   - Users can upload to own business folder (INSERT)
--   - Public read access (SELECT)
--   - Users can update own files (UPDATE)
--   - Users can delete own files (DELETE)

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

-- ❌ Error: "relation 'media_library' already exists"
--    Solution: Table already created, skip Step 1

-- ❌ Error: "function handle_updated_at() does not exist"
--    Solution: Run this first:
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ❌ Error: "bucket 'user-media' already exists"
--    Solution: Bucket already created, skip Step 2

-- ❌ Storage upload fails: "new row violates row-level security"
--    Solution: Check storage policies are correctly configured (Step 3)

-- ❌ Cannot view uploaded image: "Access denied"
--    Solution: Verify "Public read access" policy exists

-- =====================================================
-- QUICK VERIFICATION QUERIES
-- =====================================================

-- Check table structure
\d media_library;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'media_library';

-- Check triggers
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'media_library';

-- Check functions
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'increment_media_usage';

-- =====================================================
-- NEXT STEPS AFTER PHASE 1
-- =====================================================

-- Once all checkboxes above are complete:
-- ✅ Proceed to PHASE 2: Backend API
--    - Create: src/api/mediaLibrary.ts
--    - Implement: uploadToMediaLibrary, getMediaLibrary, etc.
--    - See: _MEDIA_GALLERY_IMPLEMENTATION_PLAN.md (Phase 2)

-- =====================================================
-- DOCUMENTATION REFERENCES
-- =====================================================

-- 📄 Complete Implementation Plan: _MEDIA_GALLERY_IMPLEMENTATION_PLAN.md
-- 📄 Storage Bucket Details: supabase/STORAGE_SETUP_user-media.md
-- 📄 Migration File: supabase/migrations/20260610000001_create_media_library.sql

-- =====================================================
-- Last Updated: 2026-06-10
-- =====================================================
