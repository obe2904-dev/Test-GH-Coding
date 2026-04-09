-- Database Verification Script
-- Run BEFORE attempting any cleanup
-- This checks for actual data in potentially unused tables
-- Generated: 2026-02-02

-- ============================================
-- STEP 0: Check Which Tables Actually Exist
-- ============================================

SELECT 'CHECKING TABLE EXISTENCE' as status;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) THEN '✓ EXISTS'
        ELSE '✗ NOT FOUND'
    END as status
FROM (
    VALUES 
        ('platform_intelligence'),
        ('post_drafts'),
        ('offerings'),
        ('specials'),
        ('business_concept_fit_multi'),
        ('weather_cache'),
        ('content_types'),
        ('content_distribution_rules'),
        ('platform_assignment_rules')
) AS t(table_name)
ORDER BY table_name;

-- ============================================
-- STEP 1: Check Row Counts for Existing Tables
-- ============================================

SELECT 'CHECKING ROW COUNTS (ONLY EXISTING TABLES)' as status;

-- Dynamic row count check - only queries tables that exist
DO $$
DECLARE
    table_rec RECORD;
    row_count INTEGER;
BEGIN
    -- Create temporary table for results
    CREATE TEMP TABLE IF NOT EXISTS temp_row_counts (
        table_name TEXT,
        row_count INTEGER
    );
    
    -- Clear any previous results
    TRUNCATE temp_row_counts;
    
    -- Loop through potential tables
    FOR table_rec IN 
        SELECT unnest(ARRAY[
            'platform_intelligence',
            'post_drafts',
            'offerings',
            'specials',
            'business_concept_fit_multi',
            'weather_cache',
            'content_types',
            'content_distribution_rules',
            'platform_assignment_rules'
        ]) AS tbl
    LOOP
        -- Check if table exists
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = table_rec.tbl
        ) THEN
            -- Get row count
            EXECUTE format('SELECT COUNT(*) FROM %I', table_rec.tbl) INTO row_count;
            INSERT INTO temp_row_counts VALUES (table_rec.tbl, row_count);
        ELSE
            -- Table doesn't exist
            INSERT INTO temp_row_counts VALUES (table_rec.tbl, -1);
        END IF;
    END LOOP;
END $$;

-- Display results
SELECT 
    table_name,
    CASE 
        WHEN row_count = -1 THEN 'Table does not exist'
        WHEN row_count = 0 THEN '0 rows (SAFE TO DELETE)'
        ELSE row_count::TEXT || ' rows (REVIEW BEFORE DELETING)'
    END as status,
    row_count
FROM temp_row_counts
ORDER BY row_count DESC, table_name;

-- ============================================
-- STEP 2: Check Dependencies
-- ============================================

SELECT 'CHECKING FOREIGN KEYS' as status;

-- Check foreign key constraints for these tables
SELECT
    tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN (
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

-- ============================================
-- STEP 3: Check RLS Policies
-- ============================================

SELECT 'CHECKING RLS POLICIES' as status;

SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN (
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
ORDER BY tablename, policyname;

-- ============================================
-- STEP 4: Check Triggers
-- ============================================

SELECT 'CHECKING TRIGGERS' as status;

SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN (
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

-- ============================================
-- STEP 5: Check Indexes
-- ============================================

SELECT 'CHECKING INDEXES' as status;

SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN (
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
ORDER BY tablename, indexname;

-- ============================================
-- STEP 6: Sample Data Check (Only for existing tables with data)
-- ============================================

SELECT 'SAMPLING DATA FROM TABLES' as status;

-- Note: Manually uncomment queries for tables that exist and have data
-- Run these one at a time after checking existence above

-- Platform Intelligence (uncomment if exists)
-- SELECT 'platform_intelligence sample' as info, * FROM platform_intelligence LIMIT 5;

-- Post Drafts (uncomment if exists)
-- SELECT 'post_drafts sample' as info, * FROM post_drafts LIMIT 5;

-- Offerings (uncomment if exists)
-- SELECT 'offerings sample' as info, * FROM offerings LIMIT 5;

-- Specials (uncomment if exists)
-- SELECT 'specials sample' as info, * FROM specials LIMIT 5;

-- Business Concept Fit Multi (uncomment if exists)
-- SELECT 'business_concept_fit_multi sample' as info, * FROM business_concept_fit_multi LIMIT 5;

-- Weather Cache (uncomment if exists)
-- SELECT 'weather_cache sample' as info, * FROM weather_cache LIMIT 5;

-- Content Types (uncomment if exists)
-- SELECT 'content_types sample' as info, * FROM content_types LIMIT 5;

-- Content Distribution Rules (uncomment if exists)
-- SELECT 'content_distribution_rules sample' as info, * FROM content_distribution_rules LIMIT 5;

-- Platform Assignment Rules (uncomment if exists)
-- SELECT 'platform_assignment_rules sample' as info, * FROM platform_assignment_rules LIMIT 5;

SELECT 'Manually uncomment sample queries above for tables that exist' as note;

-- ============================================
-- STEP 7: Check for References in RPC Functions
-- ============================================

SELECT 'CHECKING RPC FUNCTIONS' as status;

SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND (
        routine_definition LIKE '%platform_intelligence%' OR
        routine_definition LIKE '%post_drafts%' OR
        routine_definition LIKE '%offerings%' OR
        routine_definition LIKE '%specials%' OR
        routine_definition LIKE '%business_concept_fit_multi%' OR
        routine_definition LIKE '%weather_cache%' OR
        routine_definition LIKE '%content_types%' OR
        routine_definition LIKE '%content_distribution_rules%' OR
        routine_definition LIKE '%platform_assignment_rules%'
    );

-- ============================================
-- VERIFICATION SUMMARY
-- ============================================

SELECT 'VERIFICATION COMPLETE' as status;
SELECT '
REVIEW THE RESULTS ABOVE BEFORE PROCEEDING WITH CLEANUP

Safe to delete if:
1. Row count = 0
2. No foreign key constraints
3. No RLS policies (or you understand their purpose)
4. No triggers
5. No RPC function references
6. No important data in samples

WAIT! Before deleting:
- Export/backup your database
- Run the verification on your staging environment first
- Get stakeholder approval for data loss
' as important_notes;
