-- Add service URL fields to business_profile for web scraper v3
-- google_maps_url: Google Maps link extracted from website
-- food_inspection_url: Food safety inspection link (e.g., Findsmiley)
-- social_profiles: Array of social media profiles with platform and URL

ALTER TABLE business_profile 
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS food_inspection_url TEXT,
  ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_profile.google_maps_url IS 'Google Maps URL extracted from website by scraper';
COMMENT ON COLUMN business_profile.food_inspection_url IS 'Food safety inspection URL (e.g., Findsmiley.dk)';
COMMENT ON COLUMN business_profile.social_profiles IS 'Array of {platform, url, confidence} objects for social media profiles';
