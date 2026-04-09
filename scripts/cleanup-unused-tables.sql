-- Database Cleanup Script
-- ⚠️ DANGER: This script DELETES tables and data
-- ⚠️ DO NOT RUN WITHOUT VERIFICATION AND BACKUP
-- Generated: 2026-02-02

-- ============================================
-- PREREQUISITES (CHECK BEFORE RUNNING)
-- ============================================
-- 1. Run verify-unused-tables.sql first
-- 2. Take a FULL database backup
-- 3. Review verification results
-- 4. Get approval from stakeholders
-- 5. Test on staging environment first
-- 6. Have rollback plan ready

-- ============================================
-- SAFETY CHECK
-- ============================================

-- Uncomment this line when you're ready to proceed
-- DO $$ BEGIN RAISE NOTICE 'Starting cleanup process...'; END $$;

-- If the line above is commented, this script will fail
-- This is intentional to prevent accidental execution

-- ============================================
-- PHASE 1: BACKUP (Recommended)
-- ============================================

-- Create backup tables (optional but recommended)
-- CREATE TABLE platform_intelligence_backup AS SELECT * FROM platform_intelligence;
-- CREATE TABLE post_drafts_backup AS SELECT * FROM post_drafts;
-- CREATE TABLE offerings_backup AS SELECT * FROM offerings;
-- CREATE TABLE specials_backup AS SELECT * FROM specials;
-- CREATE TABLE business_concept_fit_multi_backup AS SELECT * FROM business_concept_fit_multi;
-- CREATE TABLE weather_cache_backup AS SELECT * FROM weather_cache;
-- CREATE TABLE content_types_backup AS SELECT * FROM content_types;
-- CREATE TABLE content_distribution_rules_backup AS SELECT * FROM content_distribution_rules;
-- CREATE TABLE platform_assignment_rules_backup AS SELECT * FROM platform_assignment_rules;

-- ============================================
-- PHASE 2: DROP UNUSED TABLES (High Confidence)
-- ============================================

-- These tables appear completely unused based on code analysis
-- Only uncomment after verification shows they're empty and safe

BEGIN;

-- 1. platform_intelligence
-- DROP TABLE IF EXISTS platform_intelligence CASCADE;
SELECT 'Would drop: platform_intelligence' as action;

-- 2. post_drafts (Note: Check if this is different from actual drafts system)
-- DROP TABLE IF EXISTS post_drafts CASCADE;
SELECT 'Would drop: post_drafts' as action;

-- 3. offerings (Note: Old table, might be replaced by business_services)
-- DROP TABLE IF EXISTS offerings CASCADE;
SELECT 'Would drop: offerings' as action;

-- 4. specials (Note: Old table, might be replaced)
-- DROP TABLE IF EXISTS specials CASCADE;
SELECT 'Would drop: specials' as action;

-- 5. business_concept_fit_multi (Note: Similar to business_concept_fit)
-- DROP TABLE IF EXISTS business_concept_fit_multi CASCADE;
SELECT 'Would drop: business_concept_fit_multi' as action;

-- 6. weather_cache (Note: If empty, safe to drop - will be recreated if needed)
-- DROP TABLE IF EXISTS weather_cache CASCADE;
SELECT 'Would drop: weather_cache' as action;

-- 7. content_types (Note: Part of content system that may not be fully implemented)
-- DROP TABLE IF EXISTS content_types CASCADE;
SELECT 'Would drop: content_types' as action;

-- 8. content_distribution_rules
-- DROP TABLE IF EXISTS content_distribution_rules CASCADE;
SELECT 'Would drop: content_distribution_rules' as action;

-- 9. platform_assignment_rules
-- DROP TABLE IF EXISTS platform_assignment_rules CASCADE;
SELECT 'Would drop: platform_assignment_rules' as action;

-- Verify tables are dropped
SELECT 
    table_name,
    'Still exists' as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'platform_intelligence',
        'post_drafts',
        'offerings',
        'specials',
        'business_concept_fit_multi',
        'weather_cache',
        'content_types',
        'content_distribution_rules',
        'platform_assignment_rules'
    );

COMMIT;
-- or ROLLBACK; if you see any issues

-- ============================================
-- PHASE 3: CLEANUP BACKUP TABLES (After verification)
-- ============================================

-- After confirming everything works, clean up backup tables
-- Run this only after several days/weeks of successful operation

-- BEGIN;
-- DROP TABLE IF EXISTS platform_intelligence_backup;
-- DROP TABLE IF EXISTS post_drafts_backup;
-- DROP TABLE IF EXISTS offerings_backup;
-- DROP TABLE IF EXISTS specials_backup;
-- DROP TABLE IF EXISTS business_concept_fit_multi_backup;
-- DROP TABLE IF EXISTS weather_cache_backup;
-- DROP TABLE IF EXISTS content_types_backup;
-- DROP TABLE IF EXISTS content_distribution_rules_backup;
-- DROP TABLE IF EXISTS platform_assignment_rules_backup;
-- COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check remaining tables
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size('public.' || table_name)) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY pg_total_relation_size('public.' || table_name) DESC;

-- Success message
SELECT '
CLEANUP STATUS: DRY RUN COMPLETE

To actually delete tables:
1. Verify all checks passed
2. Create database backup
3. Uncomment the DROP TABLE statements
4. Test on staging first
5. Re-run this script

REMEMBER: This is permanent data deletion!
' as next_steps;
