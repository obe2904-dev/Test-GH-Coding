-- Quick Fix: Run this entire script to deduplicate menu items
-- This combines all steps in the correct order

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Create the deduplication function
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
      ARRAY_AGG(min.id ORDER BY min.created_at DESC) as ids
    FROM menu_items_normalized min
    WHERE min.business_id = p_business_id
    GROUP BY UPPER(TRIM(min.item_name))
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent (first in array), delete the rest
    v_canonical_id := v_duplicate.ids[1];
    v_old_ids := v_duplicate.ids[2:array_length(v_duplicate.ids, 1)];
    
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
-- 2. Run the deduplication for Cafe Faust
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_result RECORD;
  v_total_duplicates INT := 0;
BEGIN
  RAISE NOTICE '🔄 Starting deduplication for Cafe Faust...';
  
  FOR v_result IN 
    SELECT * FROM deduplicate_menu_items('f4679fa9-3120-4a59-9506-d059b010c34a'::UUID)
  LOOP
    v_total_duplicates := v_total_duplicates + 1;
    RAISE NOTICE '✅ Deduplicated: % (kept ID: %, removed % old IDs, updated % suggestions, % posts)',
      v_result.item_name,
      v_result.canonical_id,
      array_length(v_result.old_ids, 1),
      v_result.suggestions_updated,
      v_result.posts_updated;
  END LOOP;
  
  IF v_total_duplicates = 0 THEN
    RAISE NOTICE '✨ No duplicates found - database is clean!';
  ELSE
    RAISE NOTICE '🎉 Fixed % duplicate menu items', v_total_duplicates;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Verification queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Check for remaining duplicates
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ No duplicates found'
       ELSE '❌ ' || COUNT(*) || ' duplicates still exist'
  END as status
FROM (
  SELECT 
    business_id,
    UPPER(TRIM(item_name)) as normalized_name,
    COUNT(*) as count
  FROM menu_items_normalized
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  GROUP BY business_id, UPPER(TRIM(item_name))
  HAVING COUNT(*) > 1
) duplicates;

-- Verify all suggestions have valid IDs
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
