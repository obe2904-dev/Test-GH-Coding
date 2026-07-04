-- ============================================================
-- FIX: Clear cached text when regenerating suggestions
-- Date: 2026-06-10
-- 
-- This updates the deactivate_old_suggestions function to clear
-- generated_text and related cache fields, preventing old text
-- from appearing after regeneration.
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
