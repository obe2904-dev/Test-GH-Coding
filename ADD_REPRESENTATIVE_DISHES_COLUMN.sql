-- Migration: Add representative_dishes column to menu_results_v2
-- Purpose: Store AI-selected signature/main dishes for voice profile generation
-- Date: 2026-05-24

-- Add column
ALTER TABLE menu_results_v2 
ADD COLUMN IF NOT EXISTS representative_dishes JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN menu_results_v2.representative_dishes IS 
'AI-selected 1-3 representative dishes from this menu. Used by voice profile generation. Structure: {"dishes": [{"name": "...", "description": "...", "category": "...", "price": 123, "currency": "DKK", "selection_reason": "signature|main_course|identity"}]}';

-- Create GIN index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_representative_dishes 
ON menu_results_v2 USING GIN (representative_dishes);

-- Verify migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'menu_results_v2' 
  AND column_name = 'representative_dishes';
