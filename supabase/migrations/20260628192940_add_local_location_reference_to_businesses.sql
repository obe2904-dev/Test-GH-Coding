-- Add local_location_reference to businesses table
-- User-editable field for authentic local place names
-- Examples: "ved åen", "Nyhavn", "i Vesterbro", "ved stranden"

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS local_location_reference TEXT;

COMMENT ON COLUMN businesses.local_location_reference IS 
'How locals refer to this location in natural conversation. Examples: "ved åen" (Aarhus river), "i Nyhavn" (iconic area). User-editable, AI-suggested from website analysis. Used in all content generation for authenticity.';
