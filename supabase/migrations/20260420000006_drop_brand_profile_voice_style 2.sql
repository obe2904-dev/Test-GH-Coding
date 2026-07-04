-- Drop voice_style from business_brand_profile
-- voice_style was a legacy radio-button field (casual/professional/friendly/energetic)
-- shown on BrandPage.tsx. Confirmed unused by all AI edge functions:
-- - get-quick-suggestions: explicit column list excludes voice_style
-- - generate-text-from-idea: explicit column list excludes voice_style
-- - get-weekly-strategy: only uses voice_style as an in-memory key name (maps brand_essence)
-- - generate-weekly-plan: select('*') includes it but getFormality() Priority 2 fallback is
--   never reached in practice since all businesses have tone_model populated (Priority 1)
-- UI: Radio button section removed from BrandPage.tsx (April 2026)
-- Type cleanup: Removed from BrandVoice interface, migrateLegacyVoice, getFormality in brand-voice.ts

ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS voice_style;
