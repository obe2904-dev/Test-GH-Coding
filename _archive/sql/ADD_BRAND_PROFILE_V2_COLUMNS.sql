-- ============================================================
-- ADD_BRAND_PROFILE_V2_COLUMNS.sql
-- Brand Profile V2 — new fields for redesigned generation spec.
--
-- Adds:  brand_essence_elaboration, identity_keywords, emotional_core,
--        voice_constraints
--
-- Deprecates (columns kept, not dropped — data preserved):
--   never_say        → replaced by voice_constraints
--   things_to_avoid  → replaced by voice_constraints + tone_model.avoid_examples
--
-- SAFE TO RUN MULTIPLE TIMES — every ALTER uses ADD COLUMN IF NOT EXISTS.
-- Run in Supabase SQL Editor.
-- ============================================================

-- -------------------------------------------------------
-- 1. Brand Essence elaboration (Gruppe 1)
--    2–3 strategic sentences below the identity anchor.
--    Injected as "📌 Uddybning:" in Weekly Plan prompt.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.brand_essence_elaboration IS
  'Brand Essence elaboration: 2–3 strategic sentences below the identity anchor. Injected as 📌 Uddybning: in Weekly Plan prompt.';

-- -------------------------------------------------------
-- 2. Identity keywords (Gruppe 1)
--    3 chips that describe WHO the business IS (not tone/writing style).
--    Deliberately distinct from tone_model.primary_keywords.
--    Injected as "🔑 Identitet:" in Weekly Plan prompt.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS identity_keywords TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.identity_keywords IS
  'Three identity keywords describing what the business IS. Each must pull in a different direction (atmosphere + formality + category). NOT to be confused with tone_model.primary_keywords which describe writing style.';

-- -------------------------------------------------------
-- 3. Emotional core (Gruppe 1)
--    Short text: "what the experience is really about".
--    Injected as "💡 Emotionel kerne:" in Weekly Plan prompt.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS emotional_core TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.emotional_core IS
  'Emotional core: short text explaining what the experience is really about (3–5 lines). Injected as 💡 Emotionel kerne: in Weekly Plan prompt.';

-- -------------------------------------------------------
-- 4. Voice constraints (Gruppe 4)
--    ONE principle sentence explaining WHY this style matters,
--    not a list of forbidden words. Replaces the old never_say /
--    things_to_avoid list approach.
--    Injected as "⚠️ Skriveprincip:" in Weekly Plan prompt.
-- -------------------------------------------------------
ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_constraints TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.voice_constraints IS
  'Voice constraint: one principle sentence explaining WHY this writing style matters (not a list of forbidden words). Replaces never_say + things_to_avoid. Injected as ⚠️ Skriveprincip: in Weekly Plan prompt.';

-- -------------------------------------------------------
-- 5. Mark deprecated columns
--    NOT dropped — existing data preserved.
--    New generator will write voice_constraints instead.
-- -------------------------------------------------------
COMMENT ON COLUMN public.business_brand_profile.never_say IS
  '[DEPRECATED v2] Replaced by voice_constraints. Kept for backward compatibility — not written by new generator.';

COMMENT ON COLUMN public.business_brand_profile.things_to_avoid IS
  '[DEPRECATED v2] Replaced by voice_constraints + tone_model.avoid_examples. Kept for backward compatibility — not written by new generator.';

-- -------------------------------------------------------
-- 6. Verify — should show 4 new columns
-- -------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'business_brand_profile'
  AND column_name  IN (
    'brand_essence_elaboration',
    'identity_keywords',
    'emotional_core',
    'voice_constraints'
  )
ORDER BY column_name;
