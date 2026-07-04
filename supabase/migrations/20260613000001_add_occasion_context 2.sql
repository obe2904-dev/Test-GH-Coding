-- ═══════════════════════════════════════════════════════════════════════════
-- Add occasion_context to daily_suggestions
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 13, 2026
-- Issue: why_explanation serves two masters (owner UI + Stage 2 creative brief)
-- Solution: Add dedicated occasion_context field for Stage 2 copy generation
-- Impact: Improves copy quality consistency across all content types

-- Add occasion_context column
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS occasion_context TEXT;

-- Add descriptive comment
COMMENT ON COLUMN daily_suggestions.occasion_context IS 
'Creative occasion brief for Stage 2 copy generation (1 sentence). Describes the moment/occasion/situation to write about. Example: "Frokostpause ved åen midt på dagen" or "Weekend brunch når solen rammer bordet". Used by generate-text-from-idea as LEJLIGHED/KONTEKST context.';

-- Add index for Stage 2 lookups (when filtering by business_id + date)
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_occasion 
ON daily_suggestions(business_id, date) 
WHERE occasion_context IS NOT NULL;

-- Verify migration
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_suggestions' 
    AND column_name = 'occasion_context'
  ) THEN
    RAISE NOTICE '✅ occasion_context column added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add occasion_context column';
  END IF;
END $$;
