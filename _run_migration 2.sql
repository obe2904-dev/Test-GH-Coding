-- Add occasion_context column to daily_suggestions
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS occasion_context TEXT;

COMMENT ON COLUMN daily_suggestions.occasion_context IS 
'Creative occasion brief for Stage 2 copy generation (1 sentence). Describes the moment/occasion/situation to write about. Example: "Frokostpause ved åen midt på dagen" or "Weekend brunch når solen rammer bordet". Used by generate-text-from-idea as LEJLIGHED/KONTEKST context.';

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_occasion 
ON daily_suggestions(business_id, date) 
WHERE occasion_context IS NOT NULL;

-- Verify migration
DO $$ 
BEGIN
  RAISE NOTICE '✅ occasion_context column migration complete';
END $$;
