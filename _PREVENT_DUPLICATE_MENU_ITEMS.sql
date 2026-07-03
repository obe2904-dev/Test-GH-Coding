-- Prevent Future Duplicate Menu Items
-- Add unique constraint and upsert logic to menu_items_normalized

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION 1: Add unique constraint (recommended for data integrity)
-- ═══════════════════════════════════════════════════════════════════════════

-- First, deduplicate existing data (run _FIX_DUPLICATE_MENU_ITEMS.sql first)

-- Then add a unique constraint to prevent future duplicates
-- This ensures only ONE entry per (business_id, item_name) combination
ALTER TABLE menu_items_normalized
ADD CONSTRAINT unique_menu_item_per_business 
UNIQUE (business_id, item_name);

-- Note: This will fail if duplicates still exist. Run deduplication first!

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION 2: Case-insensitive unique index (better for "MOULES" vs "Moules")
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the constraint from Option 1 if you already added it:
-- ALTER TABLE menu_items_normalized DROP CONSTRAINT IF EXISTS unique_menu_item_per_business;

-- Create a case-insensitive unique index instead
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_unique_name_per_business
ON menu_items_normalized (business_id, UPPER(TRIM(item_name)));

-- This prevents duplicates even if capitalization differs

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION 3: Upsert helper function for menu analysis
-- ═══════════════════════════════════════════════════════════════════════════

-- Use this function in menu analysis instead of INSERT
CREATE OR REPLACE FUNCTION upsert_menu_item(
  p_business_id UUID,
  p_item_name TEXT,
  p_item_description TEXT,
  p_menu_result_id UUID,
  p_service_periods TEXT[],
  p_category TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_item_id UUID;
BEGIN
  -- Try to find existing item (case-insensitive)
  SELECT id INTO v_item_id
  FROM menu_items_normalized
  WHERE business_id = p_business_id
    AND UPPER(TRIM(item_name)) = UPPER(TRIM(p_item_name));
  
  IF v_item_id IS NOT NULL THEN
    -- Update existing item
    UPDATE menu_items_normalized
    SET 
      item_name = p_item_name,  -- Update to latest capitalization
      item_description = p_item_description,
      menu_result_id = p_menu_result_id,
      service_periods = p_service_periods,
      category = COALESCE(p_category, category),
      price = COALESCE(p_price, price),
      updated_at = NOW()
    WHERE id = v_item_id;
    
    RAISE NOTICE 'Updated existing menu item: % (id: %)', p_item_name, v_item_id;
  ELSE
    -- Insert new item
    INSERT INTO menu_items_normalized (
      business_id,
      item_name,
      item_description,
      menu_result_id,
      service_periods,
      category,
      price
    ) VALUES (
      p_business_id,
      p_item_name,
      p_item_description,
      p_menu_result_id,
      p_service_periods,
      p_category,
      p_price
    ) RETURNING id INTO v_item_id;
    
    RAISE NOTICE 'Inserted new menu item: % (id: %)', p_item_name, v_item_id;
  END IF;
  
  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- Usage example:
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- In menu analysis, replace:
INSERT INTO menu_items_normalized (business_id, item_name, ...) VALUES (...)

-- With:
SELECT upsert_menu_item(
  p_business_id := 'f4679fa9-3120-4a59-9506-d059b010c34a',
  p_item_name := 'MOULES FRITES',
  p_item_description := 'with fries, aioli & fresh baked bread',
  p_menu_result_id := '772286e1-4383-45b5-b04b-9b330676f70a',
  p_service_periods := ARRAY['lunch', 'dinner']
);
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════════════════

-- Check if unique constraint/index exists
SELECT 
  conname as constraint_name,
  contype as type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'menu_items_normalized'::regclass
  AND conname LIKE '%unique%';

-- Check if index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'menu_items_normalized'
  AND indexname LIKE '%unique%';
