-- Database Audit Script
-- Run this in Supabase SQL Editor to get complete schema information
-- Generated: 2026-02-02

-- ============================================
-- PART 1: All Tables with Row Counts
-- ============================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    (SELECT COUNT(*) FROM pg_stat_user_tables WHERE schemaname='public' AND relname=tablename) as has_stats
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- PART 2: Row Counts for All Tables
-- ============================================
-- Note: Run each SELECT separately or use a script

-- Core Business Tables
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL SELECT 'businesses', COUNT(*) FROM businesses
UNION ALL SELECT 'business_team_members', COUNT(*) FROM business_team_members
UNION ALL SELECT 'business_profile', COUNT(*) FROM business_profile
UNION ALL SELECT 'business_brand_profile', COUNT(*) FROM business_brand_profile
UNION ALL SELECT 'business_locations', COUNT(*) FROM business_locations
UNION ALL SELECT 'business_operations', COUNT(*) FROM business_operations
UNION ALL SELECT 'business_visual_identity', COUNT(*) FROM business_visual_identity
UNION ALL SELECT 'business_audience_profile', COUNT(*) FROM business_audience_profile
UNION ALL SELECT 'business_goals', COUNT(*) FROM business_goals

-- Location & Intelligence Tables
UNION ALL SELECT 'business_location_intelligence', COUNT(*) FROM business_location_intelligence
UNION ALL SELECT 'opening_hours', COUNT(*) FROM opening_hours
UNION ALL SELECT 'social_accounts', COUNT(*) FROM social_accounts
UNION ALL SELECT 'platform_intelligence', COUNT(*) FROM platform_intelligence

-- Menu Tables
UNION ALL SELECT 'menu_sources', COUNT(*) FROM menu_sources
UNION ALL SELECT 'menu_extractions', COUNT(*) FROM menu_extractions
UNION ALL SELECT 'menu_results_v2', COUNT(*) FROM menu_results_v2
UNION ALL SELECT 'business_menu_metadata', COUNT(*) FROM business_menu_metadata
UNION ALL SELECT 'menu_item_metadata', COUNT(*) FROM menu_item_metadata
UNION ALL SELECT 'seasonal_ingredients', COUNT(*) FROM seasonal_ingredients

-- Content & Posts Tables
UNION ALL SELECT 'post_ideas', COUNT(*) FROM post_ideas
UNION ALL SELECT 'post_drafts', COUNT(*) FROM post_drafts
UNION ALL SELECT 'suggested_posts', COUNT(*) FROM suggested_posts
UNION ALL SELECT 'media_assets', COUNT(*) FROM media_assets

-- Offerings & Vertical-Specific Tables
UNION ALL SELECT 'offerings', COUNT(*) FROM offerings
UNION ALL SELECT 'specials', COUNT(*) FROM specials
UNION ALL SELECT 'business_services', COUNT(*) FROM business_services
UNION ALL SELECT 'business_staff', COUNT(*) FROM business_staff
UNION ALL SELECT 'business_products', COUNT(*) FROM business_products
UNION ALL SELECT 'business_classes', COUNT(*) FROM business_classes

-- Analysis & Intelligence Tables
UNION ALL SELECT 'website_analyses', COUNT(*) FROM website_analyses
UNION ALL SELECT 'brand_profile_sources_state', COUNT(*) FROM brand_profile_sources_state
UNION ALL SELECT 'third_party_evidence', COUNT(*) FROM third_party_evidence
UNION ALL SELECT 'business_concept_fit', COUNT(*) FROM business_concept_fit
UNION ALL SELECT 'business_concept_fit_multi', COUNT(*) FROM business_concept_fit_multi

-- Supporting Tables
UNION ALL SELECT 'weather_cache', COUNT(*) FROM weather_cache
UNION ALL SELECT 'contextual_calendar', COUNT(*) FROM contextual_calendar
UNION ALL SELECT 'business_documents', COUNT(*) FROM business_documents

-- System/Configuration Tables
UNION ALL SELECT 'business_type_defaults', COUNT(*) FROM business_type_defaults
UNION ALL SELECT 'content_types', COUNT(*) FROM content_types
UNION ALL SELECT 'content_distribution_rules', COUNT(*) FROM content_distribution_rules
UNION ALL SELECT 'platform_assignment_rules', COUNT(*) FROM platform_assignment_rules
UNION ALL SELECT 'content_performance_log', COUNT(*) FROM content_performance_log
UNION ALL SELECT 'content_type_baselines', COUNT(*) FROM content_type_baselines
UNION ALL SELECT 'opportunity_tracking', COUNT(*) FROM opportunity_tracking

ORDER BY table_name;

-- ============================================
-- PART 3: All Columns for Each Table
-- ============================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================
-- PART 4: Foreign Key Relationships
-- ============================================
SELECT
    tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- PART 5: RLS Policies
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- PART 6: Indexes
-- ============================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- PART 7: Triggers
-- ============================================
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- PART 8: Check for Unused Columns (No Data)
-- ============================================
-- This checks which columns are always NULL
-- Note: Run this carefully on large tables

-- Example for business_brand_profile
SELECT 
    column_name,
    COUNT(*) as total_rows,
    COUNT(column_name) as non_null_rows,
    COUNT(*) - COUNT(column_name) as null_rows,
    ROUND(100.0 * COUNT(column_name) / NULLIF(COUNT(*), 0), 2) as pct_filled
FROM business_brand_profile,
    (SELECT column_name 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
     AND table_name = 'business_brand_profile') cols
GROUP BY column_name
ORDER BY pct_filled DESC;

-- ============================================
-- PART 9: Storage Buckets
-- ============================================
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
ORDER BY name;

-- ============================================
-- PART 10: RPC Functions
-- ============================================
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
