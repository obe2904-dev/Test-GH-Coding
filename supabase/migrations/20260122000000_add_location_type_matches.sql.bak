-- Add location type matches column to business_location_intelligence
-- This stores pure location analysis - which location types match this physical location
-- Independent of business concept (menu, hours, etc.)
-- Format: { "city_centre": {"match_score": 85, "match_level": "strong", "confidence": 0.9, "reason": "..."}, ... }

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS location_type_matches JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN business_location_intelligence.location_type_matches IS 
  'Pure location type analysis - which of the 10 location types describe this physical location. ' ||
  'Independent of business concept. ' ||
  'Format: {"location_type_id": {"match_score": 0-100, "match_level": "strong|moderate|weak", "confidence": 0.0-1.0, "reason": "text"}}';

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'business_location_intelligence' 
AND column_name = 'location_type_matches';
