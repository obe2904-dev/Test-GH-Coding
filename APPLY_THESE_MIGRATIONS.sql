-- ============================================================
-- COMBINED MIGRATIONS - Apply these to fix current issues
-- Date: 2026-06-10
-- ============================================================

-- ============================================================
-- Migration 1: Enhance suggestion regeneration to clear associated drafts
-- ============================================================

CREATE OR REPLACE FUNCTION deactivate_old_suggestions(
  p_business_id UUID,
  p_date DATE
)
RETURNS void AS $$
DECLARE
  v_affected_suggestion_ids BIGINT[];
  v_deleted_drafts_count INT;
BEGIN
  -- 1. Collect IDs of suggestions that will be deactivated
  SELECT ARRAY_AGG(id)
  INTO v_affected_suggestion_ids
  FROM daily_suggestions
  WHERE business_id = p_business_id
    AND date = p_date
    AND is_active = true;

  -- 2. Delete associated post_drafts
  -- These are text generations that haven't been published/scheduled yet
  -- Published posts live in published_posts table (no suggestion_id column)
  -- so they won't be affected
  IF v_affected_suggestion_ids IS NOT NULL THEN
    DELETE FROM post_drafts
    WHERE suggestion_id = ANY(v_affected_suggestion_ids)
      AND business_id = p_business_id;
    
    GET DIAGNOSTICS v_deleted_drafts_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % post_drafts for % suggestions', 
      v_deleted_drafts_count, 
      COALESCE(array_length(v_affected_suggestion_ids, 1), 0);
  END IF;

  -- 3. Deactivate the suggestions and clear cached generated text
  --    This prevents old generated text from being reused after regeneration
  UPDATE daily_suggestions
  SET is_active = false,
      generated_text = NULL,
      generated_hashtags = NULL,
      generated_platform_content = NULL,
      generated_at = NULL,
      platforms_generated = NULL,
      text_generation_version = NULL
  WHERE business_id = p_business_id
    AND date = p_date
    AND is_active = true;
    
  RAISE NOTICE 'Deactivated % suggestions for business % on date %',
    COALESCE(array_length(v_affected_suggestion_ids, 1), 0),
    p_business_id,
    p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deactivate_old_suggestions IS
  'Deactivates suggestions for a business/date and deletes associated post_drafts. Published/scheduled posts are unaffected since they live in published_posts table.';

-- ============================================================
-- Migration 2: Add weekly_plan_slot_date and ensure all columns exist
-- ============================================================

-- Core columns used by the hook (may already exist on live DB)
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS business_id            TEXT,
  ADD COLUMN IF NOT EXISTS suggestion_id          INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_plan_id         TEXT,
  ADD COLUMN IF NOT EXISTS weekly_plan_slot_index INTEGER,
  ADD COLUMN IF NOT EXISTS platforms              TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_text              TEXT,
  ADD COLUMN IF NOT EXISTS photo_url              TEXT,
  ADD COLUMN IF NOT EXISTS content_json           JSONB;

-- NEW: slot-date key for weekly plan drafts (simpler than plan_id + index,
-- matches the same field used by published_posts for commit locking)
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS weekly_plan_slot_date DATE;

COMMENT ON COLUMN public.post_drafts.weekly_plan_slot_date IS
  'ISO date of the weekly plan slot this draft belongs to (YYYY-MM-DD). '
  'Used as the primary key for weekly plan draft lookup alongside business_id.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast lookup by business + weekly slot date
CREATE INDEX IF NOT EXISTS idx_post_drafts_business_weekly_slot
  ON public.post_drafts(business_id, weekly_plan_slot_date)
  WHERE weekly_plan_slot_date IS NOT NULL;

-- Fast lookup by business + suggestion id
CREATE INDEX IF NOT EXISTS idx_post_drafts_business_suggestion
  ON public.post_drafts(business_id, suggestion_id)
  WHERE suggestion_id IS NOT NULL;

-- Fast cleanup of stale drafts by updated_at
CREATE INDEX IF NOT EXISTS idx_post_drafts_updated_at_source
  ON public.post_drafts(updated_at, idea_source);

-- ============================================================
-- ✅ DONE! Both migrations applied.
-- ============================================================
