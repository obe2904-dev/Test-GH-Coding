-- =====================================================
-- SYNC FUNCTION: Populate menu_items_normalized from menu_results_v2
-- =====================================================
-- Purpose: Extract menu items from JSONB structured_data into normalized table
-- Run manually or via trigger after menu extraction completes

CREATE OR REPLACE FUNCTION sync_menu_items_normalized(
  p_business_id UUID DEFAULT NULL,
  p_menu_result_id UUID DEFAULT NULL
)
RETURNS TABLE (
  synced_count INTEGER,
  deleted_count INTEGER,
  business_count INTEGER
) AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
  v_business_count INTEGER := 0;
  v_menu_record RECORD;
  v_category JSONB;
  v_item JSONB;
  v_category_name TEXT;
  v_category_type TEXT;
BEGIN
  -- Track unique businesses processed
  CREATE TEMP TABLE IF NOT EXISTS processed_businesses (business_id UUID);
  
  -- Loop through menu_results_v2 records
  FOR v_menu_record IN
    SELECT 
      mr.id as menu_result_id,
      mr.business_id,
      mr.structured_data,
      mr.service_periods,
      mr.service_period_name,
      mr.is_signature,
      mr.source_url as menu_url,
      mr.sha256,
      mr.completed_at
    FROM menu_results_v2 mr
    WHERE mr.structured_data IS NOT NULL
      AND (p_business_id IS NULL OR mr.business_id = p_business_id)
      AND (p_menu_result_id IS NULL OR mr.id = p_menu_result_id)
      AND mr.status IN ('completed', 'done')
  LOOP
    -- Track business
    INSERT INTO processed_businesses (business_id) 
    VALUES (v_menu_record.business_id) 
    ON CONFLICT DO NOTHING;
    
    -- Delete existing items for this menu (allows clean re-sync)
    DELETE FROM menu_items_normalized 
    WHERE menu_result_id = v_menu_record.menu_result_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Extract categories and items from JSONB
    IF v_menu_record.structured_data ? 'categories' THEN
      FOR v_category IN 
        SELECT * FROM jsonb_array_elements(v_menu_record.structured_data->'categories')
      LOOP
        v_category_name := v_category->>'name';
        
        -- Infer category type from name
        v_category_type := CASE
          WHEN v_category_name ILIKE '%børn%' OR v_category_name ILIKE '%kids%' THEN 'kids_menu'
          WHEN v_category_name ILIKE '%dessert%' OR v_category_name ILIKE '%kage%' THEN 'dessert'
          WHEN v_category_name ILIKE '%forret%' OR v_category_name ILIKE '%starter%' THEN 'appetizer'
          WHEN v_category_name ILIKE '%tilbehør%' OR v_category_name ILIKE '%sides%' THEN 'sides'
          ELSE 'main'
        END;
        
        -- Extract items from category
        IF v_category ? 'items' THEN
          FOR v_item IN 
            SELECT * FROM jsonb_array_elements(v_category->'items')
          LOOP
            -- Only insert items with a name
            IF v_item ? 'name' AND (v_item->>'name') IS NOT NULL THEN
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
                menu_url,
                is_signature,
                source_sha256,
                synced_at
              ) VALUES (
                v_menu_record.business_id,
                v_menu_record.menu_result_id,
                v_item->>'name',
                v_item->>'description',
                classify_media_category(v_category_name, v_item->>'name', v_item->>'description'),
                v_item->>'price',
                v_category_name,
                v_category_type,
                COALESCE(v_menu_record.service_periods, ARRAY[]::TEXT[]),
                v_menu_record.service_period_name,
                v_menu_record.menu_url,
                COALESCE(v_menu_record.is_signature, false),
                v_menu_record.sha256,
                NOW()
              )
              ON CONFLICT (menu_result_id, item_name, category_name) 
              DO UPDATE SET
                item_description = EXCLUDED.item_description,
                media_category = EXCLUDED.media_category,
                item_price = EXCLUDED.item_price,
                service_periods = EXCLUDED.service_periods,
                service_period_name = EXCLUDED.service_period_name,
                is_signature = EXCLUDED.is_signature,
                source_sha256 = EXCLUDED.source_sha256,
                synced_at = NOW(),
                updated_at = NOW();
              
              v_synced_count := v_synced_count + 1;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Count unique businesses
  SELECT COUNT(*) INTO v_business_count FROM processed_businesses;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS processed_businesses;
  
  RETURN QUERY SELECT v_synced_count, v_deleted_count, v_business_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_menu_items_normalized IS 
  'Syncs menu items from menu_results_v2.structured_data to menu_items_normalized table. 
  Call with no params to sync all businesses, or specify business_id/menu_result_id to sync specific records.
  Returns (synced_count, deleted_count, business_count).';

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION sync_menu_items_normalized TO service_role;
