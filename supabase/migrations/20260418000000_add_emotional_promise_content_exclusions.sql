-- Migration: Add emotional_promise and content_exclusions to business_brand_profile
-- These two fields are synthesised by the brand-profile-generator pipeline and
-- consumed by generate-text-from-idea and get-quick-suggestions to anchor
-- non-menu posts (atmosphere, BTS) in the brand's emotional identity rather than
-- defaulting to physical inventory descriptions.
--
-- emotional_promise : one sentence — the feeling a guest takes home
--   e.g. "Det er okay at sidde længe — her er der altid tid til dig"
--
-- content_exclusions: one sentence — what the brand never posts about
--   e.g. "Skriv aldrig om møbler, inventar eller priser i stemningsopslag — vis stedet via mennesker og følelsen de bærer med hjem"

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS emotional_promise   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS content_exclusions  TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_brand_profile.emotional_promise IS
  'AI-synthesised: the emotional promise of the brand — one sentence describing the feeling a guest should walk away with. Injected as target-feeling anchor for atmosphere/BTS post generation.';

COMMENT ON COLUMN public.business_brand_profile.content_exclusions IS
  'AI-synthesised: what this brand never posts about — one sentence of negative constraints. Injected as hard prohibitions for atmosphere/BTS post generation.';
