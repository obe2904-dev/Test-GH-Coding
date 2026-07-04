-- Add detected_menu_urls column to store AI-discovered menu URLs/PDFs
-- This allows separation between detection (business info AI) and extraction (menu AI)

ALTER TABLE business_profile
ADD COLUMN detected_menu_urls text[] DEFAULT '{}';

COMMENT ON COLUMN business_profile.detected_menu_urls IS 'Menu URLs and PDF links detected by AI during website analysis, to be confirmed/edited by user before menu extraction';
