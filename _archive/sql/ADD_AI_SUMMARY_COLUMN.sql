-- Add ai_summary column to menu_results_v2
-- This stores the AI-generated high-level summary (5 bullets) per menu,
-- used in Phase 0 strategy to give AI a helicopter view before diving into items.

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS ai_summary TEXT;

COMMENT ON COLUMN menu_results_v2.ai_summary IS
  'AI-generated 5-bullet helicopter summary of this menu, used in Phase 0 strategy prompts. '
  'Generated once after extraction completes, regenerated when menu is re-extracted.';
