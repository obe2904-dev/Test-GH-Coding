-- ═══════════════════════════════════════════════════════════════════════════
-- V5 ENHANCEMENT MIGRATION: Add Structured Guardrails & Length Limits
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: May 13, 2026
-- Purpose: Enhance V5 JSONB with structured avoid_patterns and length_limits
--
-- EXECUTE AFTER: 20260509_add_brand_profile_v5_jsonb.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- This migration enhances the brand_profile_v5 JSONB structure to support:
-- 1. Structured avoid_patterns (brochure_language, superlatives, generic_marketing, ai_tells)
-- 2. Platform-specific length_limits (instagram, facebook, google, story)
-- 3. Separation of structural_rules vs style_rules in voice section

-- No schema changes needed — V5 is JSONB, so structure is flexible
-- This migration documents the enhanced structure for reference

-- ═══════════════════════════════════════════════════════════════════════════
-- ENHANCED V5 JSONB STRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN business_brand_profile.brand_profile_v5 IS 
  'V5 Brand Profile - Enhanced with structured guardrails and length limits.
   
   ENHANCED Structure (v5.1):
   {
     "version": "5.1",
     "generated_at": "2026-05-13T10:00:00Z",
     
     "programmes": [{...}],          // Layer 1-2-4: Programme detection, commercial orientation, audience segments
     
     "identity": {...},              // Layer 3: Brand essence, positioning, core values
     
     "voice": {                      // Layer 5a: Tone rules, personality traits, formality
       "tone_rules": [],             // Array of writing rules (strings)
       "structural_rules": [],       // NEW: Rules that are enforceable (e.g., "one thought per sentence")
       "style_rules": [],            // NEW: Style guidance (non-enforceable)
       "emoji_level": "minimal",
       "register_guidance": "",
       "humor_style": "",
       "formality": "",
       "avoid_examples": [],
       "content_anchors": []
     },
     
     "writing_examples": {           // Layer 5b: Typical openings/closings, signature phrases
       "typical_openings": [],
       "typical_closings": [],
       "do_say_examples": [],
       "prefer_vocabulary": [],
       "avoid_vocabulary": [],
       "signature_phrases": []
     },
     
     "guardrails": {                 // Layer 5c: Never say, content exclusions, factual constraints
       "never_say": [],
       "content_exclusions": "",
       
       "avoid_patterns": {            // NEW: Structured anti-patterns
         "brochure_language": [],     // e.g., ["pirrer næsen", "fuldender oplevelsen"]
         "superlatives": [],          // e.g., ["perfekt", "fantastisk", "unik"]
         "generic_marketing": [],     // e.g., ["forkæl dig selv", "en oplevelse"]
         "ai_tells": [],              // e.g., ["mid-sentence periods", "incomplete sentences"]
         "compound_sentences": []     // e.g., ["mens", "selvom", "fordi"] mid-sentence
       },
       
       "length_limits": {             // NEW: Platform-specific length targets
         "instagram": {
           "sentences": "3-6",
           "characters": "300-450"
         },
         "facebook": {
           "sentences": "3-6",
           "characters": "300-450"
         },
         "google": {
           "sentences": "2-4",
           "characters": "180-300"
         },
         "story": {
           "sentences": "1",
           "characters": "100-150"
         }
       }
     }
   }
   
   BACKWARD COMPATIBILITY:
   - Old V5.0 structure still works
   - New fields are optional additions
   - Legacy columns still read as fallback
   
   MIGRATION PATH:
   1. New businesses: generate with v5.1 structure
   2. Existing businesses: regenerate V5 profile to get enhanced structure
   3. UI: provide editor for avoid_patterns and length_limits';

-- Update version tracking comment
COMMENT ON COLUMN business_brand_profile.brand_profile_v5_version IS 
  'V5 schema version: "5.0" (base), "5.1" (enhanced with avoid_patterns and length_limits)';

-- ═══════════════════════════════════════════════════════════════════════════
-- DEFAULT TEMPLATES FOR VERTICAL TYPES
-- ═══════════════════════════════════════════════════════════════════════════

-- Create a function to get default avoid_patterns by vertical
CREATE OR REPLACE FUNCTION get_default_avoid_patterns(vertical_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Danish hospitality default patterns
  IF vertical_type IN ('cafe', 'restaurant', 'bar', 'bistro', 'bakery') THEN
    RETURN jsonb_build_object(
      'brochure_language', jsonb_build_array(
        'pirrer næsen',
        'pirrer sanserne',
        'fuldender oplevelsen',
        'fuldender smagsoplevelsen',
        'en oplevelse ud over det sædvanlige',
        'tager dig med på en rejse'
      ),
      'superlatives', jsonb_build_array(
        'perfekt',
        'fantastisk',
        'unik',
        'exceptionel',
        'ekstraordinær'
      ),
      'generic_marketing', jsonb_build_array(
        'forkæl dig selv',
        'du fortjener det',
        'en oplevelse for alle sanser',
        'den perfekte kombination',
        'nyd det gode liv'
      ),
      'ai_tells', jsonb_build_array(),
      'compound_sentences', jsonb_build_array(
        'mens',
        'selvom',
        'fordi'
      )
    );
  END IF;
  
  -- Default for other verticals (empty)
  RETURN jsonb_build_object(
    'brochure_language', jsonb_build_array(),
    'superlatives', jsonb_build_array(),
    'generic_marketing', jsonb_build_array(),
    'ai_tells', jsonb_build_array(),
    'compound_sentences', jsonb_build_array()
  );
END;
$$;

-- Create a function to get default length_limits
CREATE OR REPLACE FUNCTION get_default_length_limits()
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'instagram', jsonb_build_object(
      'sentences', '3-6',
      'characters', '300-450'
    ),
    'facebook', jsonb_build_object(
      'sentences', '3-6',
      'characters', '300-450'
    ),
    'google', jsonb_build_object(
      'sentences', '2-4',
      'characters', '180-300'
    ),
    'story', jsonb_build_object(
      'sentences', '1',
      'characters', '100-150'
    )
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER VIEW: V5 Enhanced Features Status
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v5_enhanced_features_status AS
SELECT 
  bbp.business_id,
  b.name as business_name,
  b.vertical,
  bbp.brand_profile_v5->>'version' as v5_version,
  
  -- Check for enhanced features
  CASE 
    WHEN bbp.brand_profile_v5->'guardrails'->'avoid_patterns' IS NOT NULL 
    THEN '✅ Yes'
    ELSE '❌ No'
  END as has_avoid_patterns,
  
  CASE 
    WHEN bbp.brand_profile_v5->'guardrails'->'length_limits' IS NOT NULL 
    THEN '✅ Yes'
    ELSE '❌ No'
  END as has_length_limits,
  
  CASE 
    WHEN bbp.brand_profile_v5->'voice'->'structural_rules' IS NOT NULL 
    THEN '✅ Yes'
    ELSE '❌ No'
  END as has_structural_rules,
  
  -- Count patterns
  COALESCE(jsonb_array_length(bbp.brand_profile_v5->'guardrails'->'avoid_patterns'->'brochure_language'), 0) as brochure_patterns_count,
  COALESCE(jsonb_array_length(bbp.brand_profile_v5->'guardrails'->'avoid_patterns'->'superlatives'), 0) as superlatives_count,
  
  -- Version check
  CASE 
    WHEN (bbp.brand_profile_v5->>'version') = '5.1' THEN '✅ Enhanced'
    WHEN (bbp.brand_profile_v5->>'version') = '5.0' THEN '⚠️ Base (needs upgrade)'
    ELSE '❌ Unknown'
  END as version_status
  
FROM business_brand_profile bbp
LEFT JOIN businesses b ON bbp.business_id = b.id
WHERE bbp.brand_profile_v5 IS NOT NULL;

COMMENT ON VIEW v5_enhanced_features_status IS 
  'Shows which businesses have enhanced V5 features (avoid_patterns, length_limits, structural_rules)';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '✅ V5 Enhancement Migration Complete';
  RAISE NOTICE '';
  RAISE NOTICE 'Enhanced V5 Structure (v5.1):';
  RAISE NOTICE '  • Structured avoid_patterns (brochure_language, superlatives, generic_marketing, ai_tells)';
  RAISE NOTICE '  • Platform-specific length_limits (instagram, facebook, google, story)';
  RAISE NOTICE '  • Separated structural_rules vs style_rules';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions Created:';
  RAISE NOTICE '  • get_default_avoid_patterns(vertical_type) → default patterns by vertical';
  RAISE NOTICE '  • get_default_length_limits() → default length targets';
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  • v5_enhanced_features_status → shows upgrade status per business';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Update brand-profile-generator-v5 Edge Function to populate new fields';
  RAISE NOTICE '  2. Create UI components for editing avoid_patterns and length_limits';
  RAISE NOTICE '  3. Update resolve-context.ts to read from V5.1 structure first';
END $$;

-- Show current status
SELECT * FROM v5_enhanced_features_status;
