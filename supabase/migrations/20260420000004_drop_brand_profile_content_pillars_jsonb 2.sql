-- Drop content_pillars_jsonb from business_brand_profile
-- Assessment (April 2026):
--   (a) get-weekly-strategy does NOT select this column — it reads content_focus and parses
--       it as content_pillars at runtime; the doc claim was inaccurate.
--   (b) get-quick-suggestions and generate-text-from-idea have zero references to content_pillars_jsonb.
--   (c) The only read path was enhancedAIContext.ts (gatherEnhancedAIContext) which has
--       zero call sites — confirmed dead code.
--   (d) content_strategy is the authoritative field used by all three AI features.
-- Write path removed from:
--   supabase/functions/_shared/brand-profile/database.ts
--   supabase/functions/brand-profile-generator/index.ts
--   src/services/enhancedAIContext.ts
--   src/types/database.ts

ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS content_pillars_jsonb;
