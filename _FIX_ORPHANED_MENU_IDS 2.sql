-- Fix Orphaned Menu IDs in daily_suggestions
-- Updates menu_item_id to match current menu_items_normalized data

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Diagnostic - Show current mismatches
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  ds.id AS suggestion_id,
  ds.menu_item_id AS orphaned_id,
  ds.menu_item_name,
  min.id AS correct_id,
  min.item_name AS correct_name,
  ds.date,
  ds.generated_text IS NOT NULL AS has_generated_text
FROM daily_suggestions ds
LEFT JOIN menu_items_normalized min 
  ON UPPER(TRIM(ds.menu_item_name)) = UPPER(TRIM(min.item_name))
  AND ds.business_id = min.business_id
WHERE ds.menu_item_id IS NOT NULL
  AND ds.menu_item_name IS NOT NULL
  AND (
    -- Either the ID doesn't exist in menu_items_normalized
    NOT EXISTS (
      SELECT 1 FROM menu_items_normalized 
      WHERE id = ds.menu_item_id
    )
    -- OR it exists but points to a different dish name
    OR ds.menu_item_id != min.id
  )
ORDER BY ds.created_at DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Fix - Update orphaned IDs to match current menu_items_normalized
-- ═══════════════════════════════════════════════════════════════════════════

-- This updates daily_suggestions.menu_item_id based on matching menu_item_name
-- Case-insensitive match to handle "MOULES FRITES" vs "Moules Frites"

UPDATE daily_suggestions ds
SET menu_item_id = min.id
FROM menu_items_normalized min
WHERE ds.menu_item_name IS NOT NULL
  AND ds.business_id = min.business_id
  AND UPPER(TRIM(ds.menu_item_name)) = UPPER(TRIM(min.item_name))
  AND (
    -- Update if ID is null
    ds.menu_item_id IS NULL
    -- OR if ID doesn't exist in menu_items_normalized (orphaned)
    OR NOT EXISTS (
      SELECT 1 FROM menu_items_normalized 
      WHERE id = ds.menu_item_id
    )
    -- OR if ID points to wrong dish
    OR ds.menu_item_id != min.id
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Verification - Show what was fixed
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  ds.id AS suggestion_id,
  ds.menu_item_name,
  ds.menu_item_id,
  min.item_name AS verified_name,
  min.item_description,
  ds.date,
  CASE 
    WHEN ds.menu_item_id = min.id THEN '✅ FIXED'
    WHEN ds.menu_item_id IS NULL THEN '⚠️ NULL (no match found)'
    ELSE '❌ STILL ORPHANED'
  END AS status
FROM daily_suggestions ds
LEFT JOIN menu_items_normalized min ON ds.menu_item_id = min.id
WHERE ds.menu_item_name IS NOT NULL
  AND ds.content_type IN ('menu_item', 'product_menu', 'craving_visual')
ORDER BY ds.created_at DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Clean up - Set menu_item_id to NULL where no match exists
-- ═══════════════════════════════════════════════════════════════════════════

-- For suggestions where we couldn't find a matching menu item, clear the ID
-- This prevents future lookups from failing on invalid IDs

UPDATE daily_suggestions
SET menu_item_id = NULL
WHERE menu_item_name IS NOT NULL
  AND menu_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items_normalized 
    WHERE id = menu_item_id
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Summary Report
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  'Total menu suggestions' AS metric,
  COUNT(*) AS count
FROM daily_suggestions
WHERE content_type IN ('menu_item', 'product_menu', 'craving_visual')

UNION ALL

SELECT 
  'With valid menu_item_id',
  COUNT(*)
FROM daily_suggestions ds
WHERE content_type IN ('menu_item', 'product_menu', 'craving_visual')
  AND menu_item_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM menu_items_normalized 
    WHERE id = ds.menu_item_id
  )

UNION ALL

SELECT 
  'With NULL menu_item_id',
  COUNT(*)
FROM daily_suggestions
WHERE content_type IN ('menu_item', 'product_menu', 'craving_visual')
  AND menu_item_id IS NULL

UNION ALL

SELECT 
  'Orphaned IDs (should be 0 after fix)',
  COUNT(*)
FROM daily_suggestions ds
WHERE content_type IN ('menu_item', 'product_menu', 'craving_visual')
  AND menu_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items_normalized 
    WHERE id = ds.menu_item_id
  );
