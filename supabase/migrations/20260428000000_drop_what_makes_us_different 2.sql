-- Drop what_makes_us_different column from business_brand_profile
-- Reason: Redundant with AI-generated brand_essence_elaboration
-- Most users think "identity" and "what makes us different" are the same
-- AI-generated differentiation already provides quality content

ALTER TABLE business_brand_profile 
DROP COLUMN IF EXISTS what_makes_us_different;

COMMENT ON TABLE business_brand_profile IS 
'Brand profile and voice model for a business. Identity differentiation is provided by brand_essence_elaboration (AI-generated) and identity_keywords (editable).';
