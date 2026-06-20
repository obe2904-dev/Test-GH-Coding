-- Schema Cleanup: Drop Unused and Orphaned Tables
-- Date: 2. juni 2026
-- 
-- This migration removes:
-- 1. Tables with zero records and no code references (6 tables)
-- 2. Tables marked as "dropped April 2026" but still exist (4 tables)
-- 
-- Total: 10 tables to drop

-- =====================================================
-- CATEGORY 1: Truly Unused Tables (No Code References)
-- =====================================================

-- business_classes: Class schedules (gyms, yoga) - never used, always empty
DROP TABLE IF EXISTS business_classes CASCADE;

-- business_products: Retail product catalog - never used, always empty
DROP TABLE IF EXISTS business_products CASCADE;

-- business_services: Service catalog (salons, clinics) - never used, always empty
DROP TABLE IF EXISTS business_services CASCADE;

-- offerings: Old table, completely unused (note: "offerings" as field name is used elsewhere)
DROP TABLE IF EXISTS offerings CASCADE;

-- post_drafts: Draft storage - never implemented, always empty
DROP TABLE IF EXISTS post_drafts CASCADE;

-- specials: Special offers - never implemented, always empty
DROP TABLE IF EXISTS specials CASCADE;

-- =====================================================
-- CATEGORY 2: "Dropped April 2026" But Still Exist
-- =====================================================
-- These tables have code comments saying "DROPPED April 2026"
-- and TypeScript warnings "Do NOT use in new code"
-- but the tables were never actually dropped from database

-- business_menu_metadata: AI-analyzed menu metadata
-- Code comment: "⚠️ DROPPED TABLE — removed April 2026. Do NOT use in new code."
-- Reality: Table still exists with 0 records
DROP TABLE IF EXISTS business_menu_metadata CASCADE;

-- business_goals: Strategic objectives per type
-- Code comment: "⚠️ DROPPED TABLE — removed April 2026. Do NOT use in new code."
-- Reality: Table still exists with 0 records
DROP TABLE IF EXISTS business_goals CASCADE;

-- business_audience_profile: Customer segments and demographics
-- Code comment: "⚠️ DROPPED TABLE — removed April 2026. Do NOT use in new code."
-- Reality: Table still exists with 0 records
DROP TABLE IF EXISTS business_audience_profile CASCADE;

-- business_visual_identity: Photography style, brand colors
-- Code comment: "business_visual_identity table dropped April 2026"
-- Reality: Table still exists with 0 records
DROP TABLE IF EXISTS business_visual_identity CASCADE;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that tables are gone
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
