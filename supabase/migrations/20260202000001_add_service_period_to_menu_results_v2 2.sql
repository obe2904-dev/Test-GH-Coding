-- Add service period columns to menu_results_v2
-- This allows menu items to be tagged with their available service periods (brunch/lunch/dinner)
-- at extraction time, making content generation more efficient

ALTER TABLE menu_results_v2
  ADD COLUMN IF NOT EXISTS service_periods TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_period_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_signature BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dish_temp_category TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN menu_results_v2.service_periods IS 'Array of service periods when this menu is available: brunch, lunch, dinner';
COMMENT ON COLUMN menu_results_v2.service_period_name IS 'Primary service period name for this menu (single value)';
COMMENT ON COLUMN menu_results_v2.is_signature IS 'Whether this menu contains signature/featured dishes';
COMMENT ON COLUMN menu_results_v2.dish_temp_category IS 'Temperature category: hot or cold (for menu items)';

-- Create index for efficient querying by service period
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_service_periods 
  ON menu_results_v2 USING GIN(service_periods);

-- Create index for signature dishes
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_signature 
  ON menu_results_v2(business_id, is_signature) 
  WHERE is_signature = true;
