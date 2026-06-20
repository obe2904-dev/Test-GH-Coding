-- =====================================================
-- MIGRATION: Add key_offerings for Free tier
-- =====================================================
-- Allows Free tier businesses to list 5-7 main products/dishes (names only)
-- for use in Dagens Forslag AI suggestions, without requiring full menu upload
-- =====================================================

-- Add key_offerings column to business_profile
ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS key_offerings TEXT;

COMMENT ON COLUMN business_profile.key_offerings IS
  'Newline-separated list of 5-7 main products/dishes (names only). Used by AI for Free tier suggestion generation. Example: "Kaffe\nSmørrebrød\nSalater\nKage\nSmoothies"';
