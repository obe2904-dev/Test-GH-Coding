-- Drop 2 derived/redundant columns from business_operations
--
-- currency:
--   Always hardcoded 'DKK' — never varied per business.
--   Currency is a country-level concern, not a per-business DB value.
--   Derived from country config (src/config/denmark.ts) wherever needed.
--   MenuPage.tsx no longer writes it; analyze-concept-fit no longer reads it.
--
-- average_check_per_person:
--   Was auto-computed from menu item prices in MenuPage.tsx and written back.
--   price_level (budget/moderate/upscale/luxury) covers the same AI signal.
--   analyze-concept-fit prompt now uses only price_level for price context.
--   MenuPage.tsx no longer writes it.

ALTER TABLE business_operations
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS average_check_per_person;
