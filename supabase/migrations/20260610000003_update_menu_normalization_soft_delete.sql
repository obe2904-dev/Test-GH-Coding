-- =====================================================
-- Update Menu Normalization Worker to Soft-Delete
-- =====================================================
-- Purpose: Change normalization trigger to soft-delete old items instead of hard-delete
-- Reason: When re-extracting same URL with updated content (e.g. seasonal menu changes),
--         preserve historical data by marking old items as is_active = false
-- Date: June 10, 2026

-- Drop and recreate the trigger function with soft-delete logic
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
                menu_language,
                is_signature,
                is_seasonal,
                is_limited_time,
                dish_temp_category,
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
                COALESCE(NEW.language_code, 'da'),
                COALESCE((v_item->>'isSignature')::BOOLEAN, false),
                COALESCE((v_item->>'isSeasonal')::BOOLEAN, false),
                COALESCE((v_item->>'isLimitedTime')::BOOLEAN, false),
                COALESCE(v_item->>'dishTempCategory', NULL),
                NEW.sha256,
                NOW()
              );
              
              v_item_count := v_item_count + 1;
              
            EXCEPTION
              WHEN OTHERS THEN
                v_error_context := format('Item: %s in category: %s', v_item->>'name', v_category_name);
                RAISE WARNING 'Failed to normalize item: %. Error: %', v_error_context, SQLERRM;
                CONTINUE;
            END;
          END LOOP;
        END IF;
        
      EXCEPTION
        WHEN OTHERS THEN
          v_error_context := format('Category: %s', v_category_name);
          RAISE WARNING 'Failed to process category: %. Error: %', v_error_context, SQLERRM;
          CONTINUE;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE 'Normalized % items from menu result %', v_item_count, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger remains the same (already exists, just updating the function)
-- trigger_sync_menu_items_on_extraction fires AFTER UPDATE on menu_results_v2
