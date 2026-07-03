-- Add is_active field to menu_items_normalized for soft-delete pattern
-- This allows us to keep menu history while marking obsolete items

-- 1. Add the column
ALTER TABLE menu_items_normalized
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Mark all current items as active
UPDATE menu_items_normalized
SET is_active = TRUE
WHERE is_active IS NULL;

-- 3. Make it non-nullable with default
ALTER TABLE menu_items_normalized
ALTER COLUMN is_active SET DEFAULT TRUE,
ALTER COLUMN is_active SET NOT NULL;

-- 4. Add index for fast active item lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_active 
ON menu_items_normalized(business_id, is_active) 
WHERE is_active = TRUE;

-- 5. Verification
SELECT 
  business_id,
  is_active,
  COUNT(*) as count
FROM menu_items_normalized
GROUP BY business_id, is_active
ORDER BY business_id, is_active;
