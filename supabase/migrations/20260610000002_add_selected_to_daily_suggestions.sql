-- =====================================================
-- Add 'selected' column to daily_suggestions
-- =====================================================
-- Fix for: 400 error when marking suggestion as selected
-- Frontend tries to update daily_suggestions.selected but column doesn't exist
-- Note: UPDATE policy already exists, only adding column

ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_selected 
  ON daily_suggestions(business_id, selected) WHERE selected = true;

COMMENT ON COLUMN daily_suggestions.selected IS
  'Tracks which suggestion the user selected to create a post from';
