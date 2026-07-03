-- Run this in Supabase SQL Editor to add detected_menu_urls column
-- Migration: 017_add_detected_menu_urls.sql

ALTER TABLE business_profile
ADD COLUMN IF NOT EXISTS detected_menu_urls text[] DEFAULT '{}';

COMMENT ON COLUMN business_profile.detected_menu_urls IS 'Menu URLs and PDF links detected by AI during website analysis, to be confirmed/edited by user before menu extraction';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_profile'
  AND column_name = 'detected_menu_urls';
