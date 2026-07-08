-- =====================================================
-- Menu Normalization Worker - Step 5 Implementation
-- =====================================================
-- Purpose: Automatically flatten menu_results_v2.structured_data into menu_items_normalized
-- Trigger: When menu extraction completes (status changes to 'done')
-- Architecture: Database trigger for zero-latency atomic normalization
-- Date: May 7, 2026

-- =====================================================
-- PART 1: Normalization Function
-- =====================================================

CREATE OR REPLACE FUNCTION sync_menu_items_to_normalized()
RETURNS TRIGGER AS $$
DECLARE
  v_category JSONB;
  v_item JSONB;
  v_category_name TEXT;
  v_category_type TEXT;
  v_service_periods TEXT[];
  v_menu_title TEXT;
  v_item_count INTEGER := 0;
  v_error_context TEXT;
BEGIN
  -- Only process when status changes to 'done' and we have structured data
  IF NEW.status != 'done' OR NEW.structured_data IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already normalized (idempotent - check by source SHA)
  IF EXISTS (
    SELECT 1 FROM menu_items_normalized 
    WHERE menu_result_id = NEW.id 
      AND source_sha256 = NEW.sha256
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Menu result % already normalized (SHA: %)', NEW.id, NEW.sha256;
    RETURN NEW;
  END IF;

  -- Soft-delete old normalized items from this URL (handles re-extraction)
  -- When restaurant updates their menu (same URL, new content), we need to deactivate old items
  UPDATE menu_items_normalized 
  SET is_active = false 
  WHERE menu_url = NEW.source_url 
    AND is_active = true;
  
  -- Extract menu title from structured data
  v_menu_title := NEW.structured_data->>'menuTitle';
  
  -- Build service_periods array from multiple sources (priority order)
  v_service_periods := ARRAY[]::TEXT[];
  
  -- Priority 1: Use parent menu_results_v2.service_periods (already parsed by parseMenuPeriods)
  IF NEW.service_periods IS NOT NULL AND ARRAY_LENGTH(NEW.service_periods, 1) > 0 THEN
    v_service_periods := NEW.service_periods;
  END IF;
  
  -- Priority 2: Infer from menu title pattern matching (fallback only)
  IF v_service_periods IS NULL OR ARRAY_LENGTH(v_service_periods, 1) IS NULL THEN
    IF v_menu_title IS NOT NULL THEN
      CASE 
        WHEN LOWER(v_menu_title) LIKE '%brunch%' THEN v_service_periods := ARRAY['brunch'];
        WHEN LOWER(v_menu_title) LIKE '%morgenmad%' OR LOWER(v_menu_title) LIKE '%breakfast%' THEN v_service_periods := ARRAY['breakfast'];
        WHEN LOWER(v_menu_title) LIKE '%frokost%' OR LOWER(v_menu_title) LIKE '%lunch%' THEN v_service_periods := ARRAY['lunch'];
        WHEN LOWER(v_menu_title) LIKE '%aften%' OR LOWER(v_menu_title) LIKE '%dinner%' THEN v_service_periods := ARRAY['dinner'];
        WHEN LOWER(v_menu_title) LIKE '%bar%' OR LOWER(v_menu_title) LIKE '%cocktail%' THEN v_service_periods := ARRAY['bar'];
        ELSE v_service_periods := ARRAY[]::TEXT[];
      END CASE;
    ELSE
      v_service_periods := ARRAY[]::TEXT[];
    END IF;
  END IF;
  
  -- Default to empty array if still null
  IF v_service_periods IS NULL THEN
    v_service_periods := ARRAY[]::TEXT[];
  END IF;

  -- Iterate through categories and items
  IF NEW.structured_data->'categories' IS NOT NULL THEN
    FOR v_category IN SELECT * FROM JSONB_ARRAY_ELEMENTS(NEW.structured_data->'categories')
    LOOP
      BEGIN
        v_category_name := v_category->>'name';
        
        -- Skip if category has no name
        IF v_category_name IS NULL OR TRIM(v_category_name) = '' THEN
          CONTINUE;
        END IF;
        
        -- Classify category type using existing function
        v_category_type := classify_category_type(v_category_name);
        
        -- Iterate through items in this category
        IF v_category->'items' IS NOT NULL THEN
          FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_category->'items')
          LOOP
            BEGIN
              -- Skip items without a name
              IF v_item->>'name' IS NULL OR TRIM(v_item->>'name') = '' THEN
                CONTINUE;
              END IF;
              
              -- Insert normalized item
              INSERT INTO menu_items_normalized (
                business_id,
                menu_result_id,
                item_name,
                item_description,
                media_category,
                item_price,
                category_name,
                category_type,
                service_periods,
                service_period_name,
                menu_title,
                menu_url,
                is_signature,
                is_seasonal,
                is_limited_time,
                dish_temp_category,
                product_segment,
                source_sha256,
                synced_at
              ) VALUES (
                NEW.business_id,
                NEW.id,
                TRIM(v_item->>'name'),
                TRIM(v_item->>'description'),
                classify_media_category(v_category_name, v_item->>'name', v_item->>'description'),
                v_item->>'price',
                v_category_name,
                v_category_type,
                v_service_periods,
                NEW.service_period_name,
                v_menu_title,
                NEW.source_url,
                COALESCE((v_item->>'is_signature')::BOOLEAN, false),
                COALESCE((v_item->>'is_seasonal')::BOOLEAN, false),
                COALESCE((v_item->>'is_limited_time')::BOOLEAN, false),
                NULL, -- dish_temp_category - to be enriched later
                v_item->>'productSegment', -- product_segment from AI extraction
                NEW.sha256,
                NOW()
              )
              ON CONFLICT (menu_result_id, item_name, category_name) 
              DO UPDATE SET
                item_description = EXCLUDED.item_description,
                item_price = EXCLUDED.item_price,
                service_periods = EXCLUDED.service_periods,
                service_period_name = EXCLUDED.service_period_name,
                menu_title = EXCLUDED.menu_title,
                is_signature = EXCLUDED.is_signature,
                is_seasonal = EXCLUDED.is_seasonal,
                is_limited_time = EXCLUDED.is_limited_time,
                product_segment = EXCLUDED.product_segment,
                source_sha256 = EXCLUDED.source_sha256,
                synced_at = NOW();
              
              v_item_count := v_item_count + 1;
              
            EXCEPTION WHEN OTHERS THEN
              -- Log item-level error but continue processing
              v_error_context := FORMAT('Item: %s, Category: %s', v_item->>'name', v_category_name);
              RAISE WARNING 'Error normalizing menu item for result %: % - %', NEW.id, SQLERRM, v_error_context;
            END;
          END LOOP;
        END IF;
        
      EXCEPTION WHEN OTHERS THEN
        -- Log category-level error but continue processing
        v_error_context := FORMAT('Category: %s', v_category_name);
        RAISE WARNING 'Error normalizing menu category for result %: % - %', NEW.id, SQLERRM, v_error_context;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE 'Normalized % items for menu result % (business: %)', v_item_count, NEW.id, NEW.business_id;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  -- Log top-level error but don't block the extraction
  RAISE WARNING 'Critical error in menu normalization for result %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_menu_items_to_normalized() IS 'Automatically flattens menu_results_v2.structured_data into menu_items_normalized rows when extraction completes';

-- =====================================================
-- PART 2: Trigger on menu_results_v2
-- =====================================================

DROP TRIGGER IF EXISTS trigger_sync_menu_items_on_extraction ON menu_results_v2;

CREATE TRIGGER trigger_sync_menu_items_on_extraction
  AFTER UPDATE OF status ON menu_results_v2
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done'))
  EXECUTE FUNCTION sync_menu_items_to_normalized();

COMMENT ON TRIGGER trigger_sync_menu_items_on_extraction ON menu_results_v2 IS 'Triggers menu item normalization when extraction completes (status changes to done)';

-- =====================================================
-- PART 3: Manual Backfill Function (for existing data)
-- =====================================================

CREATE OR REPLACE FUNCTION backfill_menu_normalization(p_limit INTEGER DEFAULT NULL)
RETURNS TABLE (
  menu_result_id UUID,
  business_id UUID,
  items_normalized INTEGER,
  status TEXT
) AS $$
DECLARE
  v_result RECORD;
  v_items_before INTEGER;
  v_items_after INTEGER;
BEGIN
  FOR v_result IN 
    SELECT mr.id, mr.business_id, mr.structured_data, mr.sha256
    FROM menu_results_v2 mr
    WHERE mr.status = 'done'
      AND mr.structured_data IS NOT NULL
      AND mr.structured_data->'categories' IS NOT NULL
    ORDER BY mr.completed_at DESC
    LIMIT COALESCE(p_limit, 999999)
  LOOP
    BEGIN
      -- Count items before
      SELECT COUNT(*) INTO v_items_before
      FROM menu_items_normalized min
      WHERE min.menu_result_id = v_result.id;
      
      -- Force trigger execution by cycling status
      -- Step 1: Change status away from 'done'
      UPDATE menu_results_v2 
      SET status = 'processing'
      WHERE id = v_result.id;
      
      -- Step 2: Change status back to 'done' to trigger normalization
      UPDATE menu_results_v2 
      SET status = 'done'
      WHERE id = v_result.id;
      
      -- Count items after
      SELECT COUNT(*) INTO v_items_after
      FROM menu_items_normalized min
      WHERE min.menu_result_id = v_result.id;
      
      RETURN QUERY SELECT 
        v_result.id,
        v_result.business_id,
        v_items_after,
        'success'::TEXT;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_result.id,
        v_result.business_id,
        0,
        FORMAT('error: %s', SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_menu_normalization IS 'Backfill normalization for existing menu_results_v2 rows. Usage: SELECT * FROM backfill_menu_normalization(10);';

-- =====================================================
-- PART 4: Monitoring View
-- =====================================================

CREATE OR REPLACE VIEW menu_normalization_stats AS
SELECT 
  mr.business_id,
  COUNT(DISTINCT mr.id) as total_menus,
  COUNT(DISTINCT mr.id) FILTER (WHERE mr.status = 'done') as completed_menus,
  COUNT(DISTINCT min.menu_result_id) as normalized_menus,
  COUNT(min.id) as total_normalized_items,
  ROUND(AVG(items_per_menu.item_count), 1) as avg_items_per_menu,
  MAX(min.synced_at) as last_sync
FROM menu_results_v2 mr
LEFT JOIN (
  SELECT menu_result_id, COUNT(*) as item_count
  FROM menu_items_normalized
  GROUP BY menu_result_id
) items_per_menu ON items_per_menu.menu_result_id = mr.id
LEFT JOIN menu_items_normalized min ON min.menu_result_id = mr.id
WHERE mr.status = 'done'
GROUP BY mr.business_id;

COMMENT ON VIEW menu_normalization_stats IS 'Monitoring view for menu normalization pipeline health';

-- =====================================================
-- PART 5: Grant Permissions
-- =====================================================

-- Service role needs full access for backfill operations
GRANT EXECUTE ON FUNCTION sync_menu_items_to_normalized() TO service_role;
GRANT EXECUTE ON FUNCTION backfill_menu_normalization(INTEGER) TO service_role;

-- Authenticated users can view stats
GRANT SELECT ON menu_normalization_stats TO authenticated;
