-- ============================================================
-- ADD_BRAND_PROFILE_V5_COLUMNS.sql
-- Catch-up migration: adds all columns written by brand-profile-generator
-- that may not yet exist in the database.
--
-- SAFE TO RUN MULTIPLE TIMES — every ALTER uses ADD COLUMN IF NOT EXISTS.
-- Run in Supabase SQL Editor.
-- ============================================================

-- -------------------------------------------------------
-- 1. Structured tone model (JSONB)
--    Written by: brand-profile-generator → database.ts
--    Used by:    enhancedAIContext.ts, get-weekly-strategy
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS tone_model JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.tone_model IS
  'Structured tone model: {emoji_level, formality, primary_keywords, writing_rules, good_examples, avoid_examples}';

-- -------------------------------------------------------
-- 2. JSONB parallels for text-only columns
--    These hold the structured objects that the TEXT columns
--    can only approximate as serialised strings.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS things_to_avoid_jsonb JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.things_to_avoid_jsonb IS
  'Structured version of things_to_avoid: {words: [], phrases: [], topics: [], reasons: {}}';

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS image_preferences_jsonb JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.image_preferences_jsonb IS
  'Structured image preferences: {style, lighting, composition, subjects[], avoid[]}';

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS core_offerings_jsonb JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.core_offerings_jsonb IS
  'Parsed core offerings: {meal_anchors[], experience_service_anchors[], unknowns[], raw_text}';

-- -------------------------------------------------------
-- 3. content_pillars (TEXT + JSONB) — from ADD_CONTENT_PILLARS_COLUMNS.sql
--    Re-declared here in case that file was never run.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS content_pillars TEXT DEFAULT NULL;

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS content_pillars_jsonb JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.content_pillars IS
  'Content pillars as serialised text (legacy; prefer content_pillars_jsonb)';

COMMENT ON COLUMN public.business_brand_profile.content_pillars_jsonb IS
  'Content pillars as JSONB array: [{name, description, examples[]}] or string[]';

-- -------------------------------------------------------
-- 4. social_style — from ADD_SOCIAL_STYLE_COLUMN.sql
--    Re-declared here in case that file was never run.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS social_style JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.social_style IS
  'Social style: {emoji_usage, emoji_examples[], hashtag_strategy:{branded[],category[],local[]}}';

-- -------------------------------------------------------
-- 5. voice_examples — from ADD_VOICE_EXAMPLES_COLUMN.sql
--    Re-declared here in case that file was never run.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_examples JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.voice_examples IS
  'Voice examples: {do_say[], dont_say[], vocabulary:{prefer[],avoid[]}}';

-- -------------------------------------------------------
-- 6. Generation quality & lifecycle tracking
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS quality_status TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.quality_status IS
  'Generation quality gate result: ''green'' | ''yellow'' | ''red''';

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS generation_errors JSONB DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.generation_errors IS
  'Array of non-fatal errors encountered during generation: [{field, error, fallback_used}]';

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS version_hash TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.version_hash IS
  'SHA-256 hash of key input signals — used to detect whether regeneration is warranted';

-- -------------------------------------------------------
-- 7. Verify — returns one row per column; all should show up
-- -------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'business_brand_profile'
  AND column_name  IN (
    'tone_model',
    'things_to_avoid_jsonb',
    'image_preferences_jsonb',
    'core_offerings_jsonb',
    'content_pillars',
    'content_pillars_jsonb',
    'social_style',
    'voice_examples',
    'quality_status',
    'generation_errors',
    'version_hash',
    'location_intelligence'   -- should already exist from previous migration
  )
ORDER BY column_name;
