-- Phase A: Foundation for Content Type System
-- Adds type system infrastructure without changing behavior

-- 1. Add target_type_mix to business_brand_profile (business-level distribution)
ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS target_type_mix JSONB DEFAULT '{
  "product": 0.35,
  "experience": 0.30,
  "occasion": 0.25,
  "retention": 0.10
}'::jsonb;

COMMENT ON COLUMN business_brand_profile.target_type_mix IS 
'Target distribution of content types across all posts over time. Used for drift correction. Default: 35% product, 30% experience, 25% occasion, 10% retention.';

-- 2. Add booking/walk-in distinction to business_programme_profiles
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS accepts_reservations BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN business_programme_profiles.accepts_reservations IS 
'Whether this programme accepts table reservations in addition to walk-ins. Used to adapt OCCASION post language (book ahead vs. come by).';

COMMENT ON COLUMN business_programme_profiles.is_active IS 
'Whether this programme is currently active and should appear in content generation.';

-- 3. Add content_type tracking to weekly_content_plans.posts
-- Note: This is a JSONB field, so we add type info to the post structure
-- Schema update happens when posts are saved, not via ALTER TABLE

COMMENT ON TABLE weekly_content_plans IS 
'Weekly content strategy and generated posts. Each post in the posts array now includes content_type and type_rationale fields for tracking content variety.';

-- 4. Create content type constants as a table (for reference/validation)
CREATE TABLE IF NOT EXISTS content_type_taxonomy (
  type_code text PRIMARY KEY,
  type_label text NOT NULL,
  description text NOT NULL,
  goal_modes text[] NOT NULL, -- Which goal modes favor this type
  example_prompts text[]
);

INSERT INTO content_type_taxonomy (type_code, type_label, description, goal_modes, example_prompts) VALUES
  ('PRODUCT', 'Product/Menu', 'Focus on specific dishes, drinks, ingredients, or preparation methods', 
   ARRAY['footfall'], 
   ARRAY['Describe this dish compellingly', 'Highlight the key ingredients', 'What makes this special?']),
   
  ('EXPERIENCE', 'Experience/Atmosphere', 'Focus on setting, place, atmosphere, or the people/process behind the food', 
   ARRAY['brand', 'retention'], 
   ARRAY['Describe the setting and atmosphere', 'Show the behind-the-scenes process', 'What''s the story of the place?']),
   
  ('OCCASION', 'Occasion/Event', 'Focus on calendar events, booking urgency, or time-sensitive opportunities', 
   ARRAY['footfall', 'brand'], 
   ARRAY['Connect to the cultural significance', 'Create booking urgency', 'Highlight the perfect timing']),
   
  ('RETENTION', 'Retention/Insider', 'Focus on insider knowledge, regular rituals, or loyalty elements', 
   ARRAY['retention'], 
   ARRAY['Share insider knowledge', 'Celebrate the regulars', 'Show what makes this special for those who know'])
ON CONFLICT (type_code) DO NOTHING;

COMMENT ON TABLE content_type_taxonomy IS 
'Reference table defining the 4 content types used in weekly plan allocation. Maps types to goal modes and provides AI prompt guidance.';

