-- Drop business_brand_profile.cta_style
--
-- Assessment (April 2026):
--   (a) UNUSED: No edge function reads this column. The ctaStyle variable in
--       generate-text-from-idea/select-cta.ts is a runtime-computed 'strict'|'soft'
--       binary derived from ctaIntent + bookingLink — entirely separate from this field.
--       gatherEnhancedAIContext() (the only path that mapped this field to a prompt) has
--       zero call sites and is dead code.
--   (b) NO VALUE IF ACTIVATED: Stores labels like "Friendly invite" / "Direct action" /
--       "Community style". The active CTA system already handles tone-of-invite via
--       typicalClosings + ctaIntent + booking-link gating + deterministic cycling.
--       This field provides no injection slot that the current prompts can use.
--
-- business_brand_profile.cta_style: confirmed safe to drop.

ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS cta_style;
