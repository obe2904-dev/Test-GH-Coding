-- Migration: Add product_segment column to menu_items_normalized
-- Date: July 8, 2026
-- Purpose: Support Phase 4 segment decomposition - product categorization for menu items

-- Add product_segment column
ALTER TABLE menu_items_normalized
ADD COLUMN product_segment text;

-- Add check constraint for valid product segment values
ALTER TABLE menu_items_normalized
ADD CONSTRAINT menu_items_normalized_product_segment_check
CHECK (
  product_segment IS NULL OR
  product_segment IN (
    'drinks',
    'snacks',
    'main_meals',
    'sharing_food',
    'desserts',
    'specials',
    'takeaway_items',
    'gifting_and_addons'
  )
);

-- Add index for filtering by product segment
CREATE INDEX IF NOT EXISTS idx_menu_items_normalized_product_segment
ON menu_items_normalized(product_segment)
WHERE product_segment IS NOT NULL;

-- Add comment
COMMENT ON COLUMN menu_items_normalized.product_segment IS 'Product classification: drinks, snacks, main_meals, sharing_food, desserts, specials, takeaway_items, gifting_and_addons';

-- Note: No backfill required - NULL is acceptable for existing items
-- New extractions will populate this field automatically via updated AI prompts
