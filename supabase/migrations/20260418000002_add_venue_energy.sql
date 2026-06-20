-- 4C: Add venue_energy column to business_brand_profile.
-- Populated by the analyze-visual-identity edge function (photo analysis).
-- 1–3 word observable energy/vibe descriptor derived from venue photo analysis
-- (e.g. "hyggelig, livlig", "intim, stille", "travl, urban").
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS venue_energy TEXT;

COMMENT ON COLUMN business_brand_profile.venue_energy IS
  '1–3 word energy/vibe descriptor from AI photo analysis (e.g. "hyggelig, livlig"). Used as tone reference in Dagens Forslag prompt.';
