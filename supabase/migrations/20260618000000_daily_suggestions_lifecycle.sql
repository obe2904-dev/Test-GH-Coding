-- ============================================================
-- Daily suggestions lifecycle
-- Date: 2026-06-18
--
-- Adds explicit lifecycle states for suggestion rows:
--   available -> selected -> consumed -> published
--
-- Also preserves historical rows by making the unique key include status,
-- so regenerated available rows can coexist with locked rows from prior steps.
-- ============================================================

-- Add the lifecycle column and timestamps used by the app.
ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_suggestions_status_check'
      AND conrelid = 'public.daily_suggestions'::regclass
  ) THEN
    ALTER TABLE public.daily_suggestions
      ADD CONSTRAINT daily_suggestions_status_check
      CHECK (status IN ('available', 'selected', 'consumed', 'published'));
  END IF;
END $$;

-- Replace the source-aware uniqueness with a status+source-aware key.
-- This keeps locked rows in the table while still allowing fresh available rows.
DO $$
BEGIN
  -- Drop the constraint from the source migration (business, date, position, source)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_suggestions_business_date_position_source_key'
      AND conrelid = 'public.daily_suggestions'::regclass
  ) THEN
    ALTER TABLE public.daily_suggestions
      DROP CONSTRAINT daily_suggestions_business_date_position_source_key;
  END IF;
  
  -- Also check for the older constraint name (before source was added)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_suggestions_business_id_suggestion_date_position_key'
      AND conrelid = 'public.daily_suggestions'::regclass
  ) THEN
    ALTER TABLE public.daily_suggestions
      DROP CONSTRAINT daily_suggestions_business_id_suggestion_date_position_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_suggestions_unique_state
  ON public.daily_suggestions (business_id, date, position, source, status);

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_business_date_status
  ON public.daily_suggestions (business_id, date, status);

-- Index for fast queries of available suggestions (most common query)
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_available 
  ON public.daily_suggestions (business_id, date, source) 
  WHERE status = 'available';

-- Index for cleanup queries (archiving old published suggestions)
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_cleanup 
  ON public.daily_suggestions (status, published_at) 
  WHERE status = 'published';

COMMENT ON COLUMN public.daily_suggestions.status IS
  'Lifecycle state for a suggestion row: available, selected, consumed, or published.';

-- Preserve the historical RPC name used by the quick-suggestion generator,
-- but make it non-destructive so regeneration no longer deletes drafts or
-- burns locked suggestion history.
CREATE OR REPLACE FUNCTION public.deactivate_old_suggestions(
  p_business_id UUID,
  p_date DATE
)
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'deactivate_old_suggestions is deprecated and now a no-op for business % on %', p_business_id, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

