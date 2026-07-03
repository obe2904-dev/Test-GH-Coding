-- Fix Duplicate Menu Items in menu_items_normalized
-- Consolidate multiple entries for the same dish into a single canonical record

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Diagnostic - Find all duplicates
-- ═══════════════════════════════════════════════════════════════════════════

-- Show all duplicate dish names (same business + item_name)
SELECT 
  business_id,
  UPPER(TRIM(item_name)) as normalized_name,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as all_ids,
  ARRAY_AGG(menu_result_id ORDER BY created_at DESC) as all_menu_result_ids,
  MAX(created_at) as most_recent
FROM menu_items_normalized
GROUP BY business_id, UPPER(TRIM(item_name))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, business_id, normalized_name;

-- Show detailed view of MOULES FRITES duplicates
SELECT 
  id,
  item_name,
  item_description,
  menu_result_id,
  created_at,
  CASE 
    WHEN created_at = (
      SELECT MAX(created_at) 
      FROM menu_items_normalized min2 
      WHERE min2.business_id = menu_items_normalized.business_id
        AND UPPER(TRIM(min2.item_name)) = UPPER(TRIM(menu_items_normalized.item_name))
    ) THEN '✅ KEEP (most recent)'
    ELSE '❌ DELETE (old)'
  END as action
FROM menu_items_normalized
WHERE UPPER(TRIM(item_name)) = 'MOULES FRITES'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Create deduplication function
-- RUN THIS STEP FIRST before running STEP 3!
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION deduplicate_menu_items(p_business_id UUID)
RETURNS TABLE(
  item_name TEXT,
  old_ids UUID[],
  canonical_id UUID,
  suggestions_updated INT,
  posts_updated INT
) AS $$
DECLARE
  v_duplicate RECORD;
  v_canonical_id UUID;
  v_old_ids UUID[];
  v_suggestions_updated INT;
  v_posts_updated INT;
BEGIN
  -- Find all duplicates for this business
  FOR v_duplicate IN
    SELECT 
      UPPER(TRIM(min.item_name)) as normalized_name,
      ARRAY_AGG(min.id ORDER BY min.created_at DESC) as ids,
      ARRAY_AGG(min.id ORDER BY min.created_at DESC)[1] as keep_id,
      ARRAY_AGG(min.id ORDER BY min.created_at DESC)[2:] as delete_ids
    FROM menu_items_normalized min
    WHERE min.business_id = p_business_id
    GROUP BY UPPER(TRIM(min.item_name))
    HAVING COUNT(*) > 1
  LOOP
    v_canonical_id := v_duplicate.keep_id;
    v_old_ids := v_duplicate.delete_ids;
    
    -- Update daily_suggestions to use canonical ID
    UPDATE daily_suggestions
    SET menu_item_id = v_canonical_id
    WHERE business_id = p_business_id
      AND menu_item_id = ANY(v_old_ids);
    GET DIAGNOSTICS v_suggestions_updated = ROW_COUNT;
    
    -- Update published_posts to use canonical ID
    UPDATE published_posts
    SET menu_item_id = v_canonical_id
    WHERE business_id = p_business_id
      AND menu_item_id = ANY(v_old_ids);
    GET DIAGNOSTICS v_posts_updated = ROW_COUNT;
    
    -- Delete old duplicate entries
    DELETE FROM menu_items_normalized
    WHERE id = ANY(v_old_ids);
    
    -- Return result row
    item_name := v_duplicate.normalized_name;
    old_ids := v_old_ids;
    canonical_id := v_canonical_id;
    suggestions_updated := v_suggestions_updated;
    posts_updated := v_posts_updated;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Run deduplication for Cafe Faust
-- IMPORTANT: Run STEP 2 first to create the function!
-- ═══════════════════════════════════════════════════════════════════════════

SELECT * FROM deduplicate_menu_items('f4679fa9-3120-4a59-9506-d059b010c34a'::UUID);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Verification
-- ═══════════════════════════════════════════════════════════════════════════

-- Should show only 1 entry for MOULES FRITES now
SELECT 
  id,
  item_name,
  item_description,
  menu_result_id,
  created_at
FROM menu_items_normalized
WHERE UPPER(TRIM(item_name)) = 'MOULES FRITES'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- Check for any remaining duplicates
SELECT 
  business_id,
  UPPER(TRIM(item_name)) as normalized_name,
  COUNT(*) as count_after_fix
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY business_id, UPPER(TRIM(item_name))
HAVING COUNT(*) > 1;

-- Verify all suggestions now point to valid IDs
SELECT 
  COUNT(*) FILTER (WHERE menu_item_id IS NULL) as null_ids,
  COUNT(*) FILTER (WHERE menu_item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM menu_items_normalized WHERE id = daily_suggestions.menu_item_id
  )) as valid_ids,
  COUNT(*) FILTER (WHERE menu_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM menu_items_normalized WHERE id = daily_suggestions.menu_item_id
  )) as orphaned_ids
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND content_type IN ('menu_item', 'product_menu', 'craving_visual');
