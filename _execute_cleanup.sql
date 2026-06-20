-- =====================================================
-- SCHEMA CLEANUP: Drop 10 Unused Tables
-- Execute in Supabase SQL Editor
-- Date: 2. juni 2026
-- =====================================================

-- Category 1: Never Used (6 tables)
DROP TABLE IF EXISTS business_classes CASCADE;
DROP TABLE IF EXISTS business_products CASCADE;
DROP TABLE IF EXISTS business_services CASCADE;
DROP TABLE IF EXISTS offerings CASCADE;
DROP TABLE IF EXISTS post_drafts CASCADE;
DROP TABLE IF EXISTS specials CASCADE;

-- Category 2: "Dropped April 2026" But Still Exist (4 tables)
DROP TABLE IF EXISTS business_menu_metadata CASCADE;
DROP TABLE IF EXISTS business_goals CASCADE;
DROP TABLE IF EXISTS business_audience_profile CASCADE;
DROP TABLE IF EXISTS business_visual_identity CASCADE;

-- Verification
DO $$
DECLARE
  dropped_tables TEXT[] := ARRAY[
    'business_classes',
    'business_products', 
    'business_services',
    'offerings',
    'post_drafts',
    'specials',
    'business_menu_metadata',
    'business_goals',
    'business_audience_profile',
    'business_visual_identity'
  ];
  tbl_name TEXT;
  still_exists BOOLEAN;
BEGIN
  RAISE NOTICE '=== Verifying Table Cleanup ===';
  
  FOREACH tbl_name IN ARRAY dropped_tables LOOP
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND tables.table_name = tbl_name
    ) INTO still_exists;
    
    IF still_exists THEN
      RAISE WARNING '❌ Table % still exists!', tbl_name;
    ELSE
      RAISE NOTICE '✅ Table % successfully dropped', tbl_name;
    END IF;
  END LOOP;
END $$;
