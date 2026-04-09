-- Migration: copy long_description → business_character for existing users
-- Safe to run multiple times (idempotent).
-- Only touches rows where business_character IS NULL and long_description IS NOT NULL.
-- Preserves any manually entered business_character values.

INSERT INTO business_brand_profile (business_id, business_character)
SELECT
  bp.business_id,
  bp.long_description
FROM business_profile bp
WHERE bp.long_description IS NOT NULL
  AND bp.long_description <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM business_brand_profile bbp
    WHERE bbp.business_id = bp.business_id
      AND bbp.business_character IS NOT NULL
      AND bbp.business_character <> ''
  )
ON CONFLICT (business_id)
DO UPDATE SET
  business_character = EXCLUDED.business_character
WHERE business_brand_profile.business_character IS NULL
   OR business_brand_profile.business_character = '';
