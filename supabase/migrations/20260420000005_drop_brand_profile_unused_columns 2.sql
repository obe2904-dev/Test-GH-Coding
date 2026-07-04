-- Drop 8 unused columns from business_brand_profile
--
-- Assessment: all 8 columns are confirmed dead:
--   personality              — Added in 20260204000000; never written by brand-profile-generator or
--                              any other live edge function; not in any active TypeScript service or
--                              component. Only referenced in archived docs and schema comments.
--   voice_execution          — Same migration; same verdict. Referenced only in test snapshots and docs.
--   execution_profile        — Added in 20260107000000; never read back by any edge function or service.
--                              Only in archived SQL queries.
--   emotional_core           — In database.ts types but never accessed at runtime; no service reads it.
--   brand_strategy           — In database.ts types only; never written or read in live code.
--   who_when_why             — In database.ts types only; never written or read in live code.
--   who_when_why_internal    — In database.ts types only; never written or read in live code.
--   offerings_full           — Written only from BrandProfilePageNew.tsx → lib/brandStrategy/generator.ts,
--                              which is dead code (not routed in App.tsx). In supabase.ts types only.
--
-- Columns NOT dropped (wired to active code):
--   voice_style              — BrandPage.tsx radio button UI reads/writes it (active user-facing widget)
--   certifications           — generate-weekly-plan reads via select('*') + passes to feasibility validator
--   social_style             — brand-profile-generator writes; enhancedAIContext.ts reads
--   image_preferences        — brandProfileService.ts + database.ts active write/read paths
--   values                   — BrandPage.tsx reads/writes
--   owner_document           — brand-profile-generator writes; BrandProfileDisplay.tsx shows it

ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS personality,
  DROP COLUMN IF EXISTS voice_execution,
  DROP COLUMN IF EXISTS execution_profile,
  DROP COLUMN IF EXISTS emotional_core,
  DROP COLUMN IF EXISTS brand_strategy,
  DROP COLUMN IF EXISTS who_when_why,
  DROP COLUMN IF EXISTS who_when_why_internal,
  DROP COLUMN IF EXISTS offerings_full;

-- Clean up orphaned validation functions from 20260204000000_add_voice_patterns.sql
-- (The CHECK constraints that used these were dropped with the columns above)
DROP FUNCTION IF EXISTS validate_voice_execution(jsonb);
DROP FUNCTION IF EXISTS validate_personality(jsonb);
