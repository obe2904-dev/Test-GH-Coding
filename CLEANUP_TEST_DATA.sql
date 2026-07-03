-- ============================================================
--  CLEANUP: Delete all test posts and ideas
--
--  Deletes all rows for the test business across:
--    • published_posts  — drafts, scheduled, and published posts
--    • daily_suggestions — AI-generated ideas
--
--  Scoped to the single test business ID so production data
--  (other businesses) is never touched.
--
--  Run once in Supabase SQL editor.
-- ============================================================

DO $$
DECLARE
  v_business_id UUID := 'f4679fa9-3120-4a59-9506-d059b010c34a';
  v_posts       INT;
  v_ideas       INT;
BEGIN
  -- 1. All posts (draft, scheduled, published)
  DELETE FROM published_posts  WHERE business_id = v_business_id;
  GET DIAGNOSTICS v_posts  = ROW_COUNT;

  -- 2. AI ideas (daily suggestions)
  DELETE FROM daily_suggestions WHERE business_id = v_business_id;
  GET DIAGNOSTICS v_ideas  = ROW_COUNT;

  RAISE NOTICE 'Deleted: % published_posts (all statuses), % daily_suggestions',
    v_posts, v_ideas;
END $$;
