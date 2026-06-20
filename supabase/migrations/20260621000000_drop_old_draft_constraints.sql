-- ============================================================
-- Drop old unique constraints from post_drafts
-- Date: 2026-06-21
--
-- The old constraints (post_drafts_suggestion_unique, etc.) 
-- prevent per-platform splits because they don't include platform.
-- We need to drop them since the new platform-aware constraints
-- from migration 20260619000000_per_platform_drafts.sql are active.
-- ============================================================

-- Drop old suggestion constraint (business_id, suggestion_id)
-- Replaced by idx_post_drafts_unique_platform_suggestion
DROP INDEX IF EXISTS post_drafts_suggestion_unique;

-- Drop old weekly plan constraint (business_id, weekly_plan_id, weekly_plan_slot_index)
-- Replaced by idx_post_drafts_unique_platform_weekly
DROP INDEX IF EXISTS post_drafts_weekly_plan_unique;

-- Drop old write constraint (business_id)
-- Replaced by idx_post_drafts_unique_platform_write
DROP INDEX IF EXISTS post_drafts_write_unique;

COMMENT ON TABLE post_drafts IS
  'Per-platform post drafts. After 2026-06-21, each draft has a single platform value. Legacy drafts (platform IS NULL) may exist from before migration.';
