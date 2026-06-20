-- Drop shadow columns from business_profile
-- These are duplicates of authoritative columns elsewhere; nothing reads them.
--
-- target_audience  → authoritative: business_brand_profile.target_audience
-- booking_url      → authoritative: business_brand_profile.booking_link
-- price_level      → authoritative: business_operations.price_level (used in all 3 AI features)

ALTER TABLE business_profile DROP COLUMN IF EXISTS target_audience;
ALTER TABLE business_profile DROP COLUMN IF EXISTS booking_url;
ALTER TABLE business_profile DROP COLUMN IF EXISTS price_level;
