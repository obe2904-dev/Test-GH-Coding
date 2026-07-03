-- Cleanup Script for Empty Tables
-- Run this to delete confirmed empty, unused tables
-- Generated: 2026-02-02
-- Based on actual database analysis

-- ============================================
-- SAFETY: Backup first!
-- ============================================
-- This script will DELETE tables permanently
-- Make sure you have a database backup before proceeding

BEGIN;

-- ============================================
-- PHASE 1: Delete Empty "Unused" Tables
-- High confidence - these are empty and not used in code
-- ============================================

-- 1. business_concept_fit_multi (0 rows, similar to business_concept_fit which is used)
DROP TABLE IF EXISTS business_concept_fit_multi CASCADE;

-- 2. post_drafts (0 rows, likely old drafts system)
DROP TABLE IF EXISTS post_drafts CASCADE;

-- 3. specials (0 rows, old table not in use)
DROP TABLE IF EXISTS specials CASCADE;

-- 4. offerings (0 rows, replaced by business_services)
DROP TABLE IF EXISTS offerings CASCADE;

-- ============================================
-- PHASE 2: Delete Old/Replaced Tables (Optional)
-- These are empty and appear to be old versions
-- ============================================

-- 5. menu_results (0 rows, replaced by menu_results_v2)
DROP TABLE IF EXISTS menu_results CASCADE;

-- 6. menu_extractions (0 rows, might be used in future)
-- DROP TABLE IF EXISTS menu_extractions CASCADE;

-- ============================================
-- PHASE 3: Delete Empty System Tables (Careful!)
-- These may be needed for future features
-- Only uncomment if you're SURE they won't be used
-- ============================================

-- 7. content_performance_log (0 rows, performance tracking system)
-- DROP TABLE IF EXISTS content_performance_log CASCADE;

-- 8. content_type_baselines (0 rows, performance tracking system)
-- DROP TABLE IF EXISTS content_type_baselines CASCADE;

-- 9. media_assets (0 rows, might be used for images)
-- DROP TABLE IF EXISTS media_assets CASCADE;

-- 10. social_accounts (0 rows, social media integration)
-- DROP TABLE IF EXISTS social_accounts CASCADE;

-- 11. opportunity_tracking (0 rows, analytics system)
-- DROP TABLE IF EXISTS opportunity_tracking CASCADE;

-- 12. business_team_members (0 rows, team collaboration feature)
-- DROP TABLE IF EXISTS business_team_members CASCADE;

-- ============================================
-- KEEP THESE (Have Configuration Data)
-- ============================================
-- DO NOT DELETE:
-- - content_types (17 rows - system config)
-- - content_distribution_rules (19 rows - system config)
-- - platform_assignment_rules (17 rows - system config)

-- ============================================
-- Verify Deletions
-- ============================================
SELECT 'Deleted tables:' as status;
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN (
        'business_concept_fit_multi',
        'post_drafts',
        'specials',
        'offerings',
        'menu_results'
    );

-- Should return 0 rows if all deleted successfully

-- ============================================
-- Database Maintenance (Recommended)
-- ============================================
-- After deletion, reclaim space and update statistics
VACUUM ANALYZE;

COMMIT;
-- or ROLLBACK; if you see any issues

SELECT 'Cleanup complete! Run VACUUM ANALYZE to reclaim space.' as result;
