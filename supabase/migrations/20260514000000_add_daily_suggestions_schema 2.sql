-- =====================================================
-- MIGRATION: Add daily_suggestions schema for Free tier AI Ideas
-- =====================================================
-- Fixes missing database objects needed by get-quick-suggestions Edge Function
-- Found via logs: PGRST205 error (table missing) and 42703 error (column missing)
-- =====================================================

-- ── 1. Add quota tracking column to businesses table ──────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS quick_suggestions_today SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN businesses.quick_suggestions_today IS
  'Count of AI suggestion regenerations today (Free tier). Resets daily.';

-- ── 2. Create daily_suggestions cache table ───────────────────────────────
CREATE TABLE IF NOT EXISTS daily_suggestions (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  suggestion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  
  -- Suggestion content
  title TEXT NOT NULL,
  rationale TEXT,
  why_explanation TEXT,
  
  -- Menu item reference (if applicable)
  menu_item_name TEXT,
  menu_item_description TEXT,
  
  -- Post metadata
  content_type TEXT NOT NULL DEFAULT 'menu_item',
  caption_base TEXT,
  cta_intent TEXT DEFAULT 'visit',
  
  -- Media suggestion
  photo_idea TEXT,
  media_suggestion JSONB,
  
  -- Timing
  suggested_time TIME,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one business can have max 3 suggestions per day (positions 1, 2, 3)
  UNIQUE(business_id, suggestion_date, position)
);

-- Index for fast lookups by business + date
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_business_date 
  ON daily_suggestions(business_id, suggestion_date);

-- Index for cleanup queries (find old suggestions to delete)
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_date 
  ON daily_suggestions(suggestion_date);

COMMENT ON TABLE daily_suggestions IS
  'Caches AI-generated post suggestions for Free tier. One business gets 3 suggestions per day (positions 1-3). Upserted on regenerate.';

-- ── 3. Enable RLS on daily_suggestions ────────────────────────────────────
ALTER TABLE daily_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can select their own suggestions
CREATE POLICY "Users can select their own daily suggestions"
  ON daily_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = daily_suggestions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert their own suggestions
CREATE POLICY "Users can insert their own daily suggestions"
  ON daily_suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = daily_suggestions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can update their own suggestions
CREATE POLICY "Users can update their own daily suggestions"
  ON daily_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = daily_suggestions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete their own suggestions
CREATE POLICY "Users can delete their own daily suggestions"
  ON daily_suggestions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = daily_suggestions.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- ── 4. Create cleanup function for old suggestions ────────────────────────
-- Keeps only last 7 days of suggestions to prevent table bloat
CREATE OR REPLACE FUNCTION cleanup_old_daily_suggestions()
RETURNS void AS $$
BEGIN
  DELETE FROM daily_suggestions
  WHERE suggestion_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_daily_suggestions IS
  'Deletes daily_suggestions older than 7 days. Run daily via cron.';
