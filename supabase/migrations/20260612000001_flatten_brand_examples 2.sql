-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Flatten Brand Profile Examples to Top-Level Columns
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 12, 2026
-- Purpose: Move examples from nested JSONB to dedicated top-level columns
--          for better accessibility and query performance
--
-- MOTIVATION:
-- - Current: brand_profile_v5.voice.enhanced_social_examples (3 levels deep)
-- - Problem: Hard to query, complex JSONB operators, empty fallback fields
-- - Solution: Dedicated columns with simple COALESCE fallback chains
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add dedicated example columns at table root level
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS enhanced_social_examples JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enhanced_avoid_examples JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS social_writing_examples JSONB DEFAULT '[]'::jsonb;

-- 2. Add GIN indexes for fast array/JSONB queries
CREATE INDEX IF NOT EXISTS idx_enhanced_social_examples 
  ON business_brand_profile USING GIN (enhanced_social_examples);

CREATE INDEX IF NOT EXISTS idx_enhanced_avoid_examples 
  ON business_brand_profile USING GIN (enhanced_avoid_examples);

CREATE INDEX IF NOT EXISTS idx_social_writing_examples 
  ON business_brand_profile USING GIN (social_writing_examples);

-- 3. Migrate existing data from nested structure to new columns
UPDATE business_brand_profile
SET 
  enhanced_social_examples = COALESCE(
    brand_profile_v5->'voice'->'enhanced_social_examples',
    '[]'::jsonb
  ),
  enhanced_avoid_examples = COALESCE(
    brand_profile_v5->'voice'->'enhanced_avoid_examples',
    '[]'::jsonb
  ),
  social_writing_examples = COALESCE(
    brand_profile_v5->'writing_examples'->'good_examples',
    '[]'::jsonb
  )
WHERE brand_profile_v5 IS NOT NULL;

-- 4. Add helpful comments
COMMENT ON COLUMN business_brand_profile.enhanced_social_examples IS 
  'Enhanced social media examples with reasoning and strategic context.
   
   Structure: Array of objects with text, why_it_works, tone_elements_demonstrated
   Example: [
     {
       "text": "Start din dag med brunch ved åen 🌅",
       "content_type": "menu_item",
       "why_it_works": ["Direct waterfront reference", "Concrete menu anchor"],
       "tone_elements_demonstrated": ["location_driver", "owner_voice"]
     }
   ]
   
   Fallback chain: enhanced_social_examples → social_writing_examples → []
   Used by: generate-text-from-idea (paid tier), ai-enhance, adjust-text';

COMMENT ON COLUMN business_brand_profile.enhanced_avoid_examples IS 
  'Enhanced avoid examples showing what NOT to write, with reasoning.
   
   Structure: Array of objects with text, why_it_fails, violates_dna_elements
   Example: [
     {
       "text": "Oplev en uforglemmelig kulinarisk rejse",
       "why_it_fails": ["Misses waterfront USP", "Hype language clashes with owner voice"],
       "violates_dna_elements": ["location_driver", "owner_voice_register"]
     }
   ]
   
   Used by: Voice validation, text generation guardrails';

COMMENT ON COLUMN business_brand_profile.social_writing_examples IS 
  'Simple social media writing examples (strings only) used as fallback.
   
   Structure: Array of strings
   Example: ["Kom forbi til brunch ved åen", "Nyd en afslappet middag"]
   
   Purpose: Lightweight fallback when enhanced_social_examples is empty
   Populated from: voice_profile.social_writing_examples during V5 generation';

-- 5. Create view for easy fallback queries
CREATE OR REPLACE VIEW brand_examples_with_fallback AS
SELECT 
  bbp.business_id,
  b.name as business_name,
  
  -- Examples with fallback chain
  COALESCE(
    NULLIF(bbp.enhanced_social_examples, '[]'::jsonb),
    NULLIF(bbp.social_writing_examples, '[]'::jsonb),
    '[]'::jsonb
  ) as effective_social_examples,
  
  COALESCE(
    NULLIF(bbp.enhanced_avoid_examples, '[]'::jsonb),
    '[]'::jsonb
  ) as effective_avoid_examples,
  
  -- Metadata
  jsonb_array_length(bbp.enhanced_social_examples) as enhanced_count,
  jsonb_array_length(bbp.social_writing_examples) as simple_count,
  
  CASE 
    WHEN jsonb_array_length(bbp.enhanced_social_examples) > 0 THEN 'enhanced'
    WHEN jsonb_array_length(bbp.social_writing_examples) > 0 THEN 'simple'
    ELSE 'empty'
  END as example_tier
  
FROM business_brand_profile bbp
LEFT JOIN businesses b ON bbp.business_id = b.id;

COMMENT ON VIEW brand_examples_with_fallback IS 
  'Simplifies example queries with automatic fallback logic.
   
   Usage:
   SELECT effective_social_examples 
   FROM brand_examples_with_fallback 
   WHERE business_id = $1;
   
   Returns enhanced examples if available, falls back to simple, then empty array.';

-- 6. Add validation constraint (examples must be arrays)
ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_enhanced_social_examples_is_array 
  CHECK (jsonb_typeof(enhanced_social_examples) = 'array');

ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_enhanced_avoid_examples_is_array 
  CHECK (jsonb_typeof(enhanced_avoid_examples) = 'array');

ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_social_writing_examples_is_array 
  CHECK (jsonb_typeof(social_writing_examples) = 'array');

-- 7. Verification queries
DO $$
DECLARE
  migrated_count INTEGER;
  enhanced_count INTEGER;
  simple_count INTEGER;
BEGIN
  -- Count migrated records
  SELECT COUNT(*) INTO migrated_count
  FROM business_brand_profile
  WHERE enhanced_social_examples != '[]'::jsonb 
     OR social_writing_examples != '[]'::jsonb;
  
  SELECT COUNT(*) INTO enhanced_count
  FROM business_brand_profile
  WHERE jsonb_array_length(enhanced_social_examples) > 0;
  
  SELECT COUNT(*) INTO simple_count
  FROM business_brand_profile
  WHERE jsonb_array_length(social_writing_examples) > 0;
  
  RAISE NOTICE '✅ Migration complete:';
  RAISE NOTICE '   - Total records migrated: %', migrated_count;
  RAISE NOTICE '   - With enhanced examples: %', enhanced_count;
  RAISE NOTICE '   - With simple examples: %', simple_count;
END $$;

-- 8. Show sample data
SELECT 
  business_id,
  example_tier,
  enhanced_count,
  simple_count
FROM brand_examples_with_fallback
LIMIT 5;
