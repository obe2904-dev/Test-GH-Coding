-- =====================================================
-- Merge Duplicate Café Faust Business Records
-- =====================================================
-- Purpose: Consolidate duplicate Café Faust records into single canonical business
-- Issue: Two business_id values exist for same restaurant causing data fragmentation
-- Solution: Merge all data from old record (840347de) into active record (2037d63c)
-- Date: May 7, 2026

-- Active (Keep): 2037d63c-a138-4247-89c5-5b6b8cef9f3f (Cafe Faust - Feb 18, last updated today)
-- Old (Merge): 840347de-9ba7-4275-8aa3-4553417fc2af (Café Faust - Jan 18, last updated Feb 2)

BEGIN;

DO $$
DECLARE
  v_target_id UUID := '2037d63c-a138-4247-89c5-5b6b8cef9f3f'; -- Active business (keeping)
  v_source_id UUID := '840347de-9ba7-4275-8aa3-4553417fc2af'; -- Old business (merging)
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Café Faust duplicate merge';
  RAISE NOTICE 'Source (old): %', v_source_id;
  RAISE NOTICE 'Target (active): %', v_target_id;
  RAISE NOTICE '========================================';
  
  -- =====================================================
  -- STEP 1: Merge menu_items_normalized
  -- =====================================================
  UPDATE menu_items_normalized
  SET business_id = v_target_id
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[1/12] Migrated % menu_items_normalized records', v_updated_count;
  
  -- =====================================================
  -- STEP 2: Merge menu_results_v2
  -- =====================================================
  UPDATE menu_results_v2
  SET business_id = v_target_id
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[2/12] Migrated % menu_results_v2 records', v_updated_count;
  
  -- =====================================================
  -- STEP 3: Handle menu_sources (delete duplicates, target already has them)
  -- =====================================================
  DELETE FROM menu_sources
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[3/12] Deleted % duplicate menu_sources records', v_updated_count;
  
  -- =====================================================
  -- STEP 4: Handle opening_hours (delete duplicates, keep target)
  -- =====================================================
  DELETE FROM opening_hours
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[4/12] Deleted % duplicate opening_hours records', v_updated_count;
  
  -- =====================================================
  -- STEP 5: Handle business_profile (keep target, delete source duplicate)
  -- =====================================================
  DELETE FROM business_profile
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[5/12] Deleted % duplicate business_profile records', v_updated_count;
  
  -- =====================================================
  -- STEP 6: Handle business_operations (keep target, delete source duplicate)
  -- =====================================================
  DELETE FROM business_operations
  WHERE business_id = v_source_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '[6/12] Deleted % duplicate business_operations records', v_updated_count;
  
  -- =====================================================
  -- STEP 7: Update target business name to canonical form (with accent)
  -- =====================================================
  UPDATE businesses
  SET name = 'Café Faust'
  WHERE id = v_target_id;
  
  RAISE NOTICE '[7/8] Updated target business name to "Café Faust"';
  
  -- =====================================================
  -- STEP 8: Delete source business record
  -- =====================================================
  DELETE FROM businesses
  WHERE id = v_source_id;
  
  RAISE NOTICE '[8/8] Deleted source business record';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Merge complete!';
  RAISE NOTICE 'All data consolidated under business_id: %', v_target_id;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- Verification Query
-- =====================================================
SELECT 
  b.id,
  b.name,
  b.created_at,
  (SELECT COUNT(*) FROM menu_items_normalized WHERE business_id = b.id) as menu_items_normalized,
  (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = b.id) as menu_results,
  (SELECT COUNT(*) FROM opening_hours WHERE business_id = b.id) as opening_hours
FROM businesses b
WHERE name ILIKE '%faust%';

COMMIT;
