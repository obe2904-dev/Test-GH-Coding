-- Simple Table Inventory Check
-- Shows all tables in your database with row counts and sizes

SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Show which "unused" tables actually exist
SELECT 
    'Tables from unused list that EXIST:' as info,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'platform_intelligence',
        'post_drafts',
        'offerings',
        'specials',
        'business_concept_fit_multi',
        'weather_cache',
        'content_types',
        'content_distribution_rules',
        'platform_assignment_rules'
    )
ORDER BY tablename;

-- Get row counts for all tables
SELECT 
    schemaname,
    relname as tablename,
    n_live_tup as estimated_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
