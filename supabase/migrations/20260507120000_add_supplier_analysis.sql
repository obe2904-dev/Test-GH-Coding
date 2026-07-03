-- Add supplier_analysis JSONB column to business_location_intelligence
-- This stores supplier distance data extracted from menu items
-- Structure:
-- {
--   "suppliers": [
--     {
--       "name": "Højer",
--       "type": "location",
--       "distance_km": 160,
--       "verified": true,
--       "mentioned_in": ["THE ONE brunch", "Frokost menu"]
--     }
--   ],
--   "geographic_scope": "regional",  -- "local" (<30km), "regional" (30-100km), "national" (>100km)
--   "local_count": 0,
--   "regional_count": 2,
--   "national_count": 0,
--   "updated_at": "2026-05-07T..."
-- }

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS supplier_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN business_location_intelligence.supplier_analysis IS 
'Supplier location and distance analysis extracted from menu items. Used for factual geographic claims in brand profile.';
