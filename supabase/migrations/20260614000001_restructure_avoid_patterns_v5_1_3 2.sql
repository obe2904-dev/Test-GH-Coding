-- =====================================================
-- MIGRATION: v5.1.3 - Restructure avoid_patterns
-- =====================================================
-- Date: June 14, 2026 14:00 UTC
-- Purpose: Split avoid_patterns into strip_from_output vs generation_constraints
--          to prevent sentence amputation bugs from common words like "når", "da"
--
-- Before:
--   avoid_patterns: {
--     brochure_language: [...],
--     superlatives: [...],
--     generic_marketing: [...],
--     ai_tells: [...],
--     compound_sentences: ["mens", "selvom", "når", "da"]  <- DANGER: common words
--   }
--
-- After:
--   avoid_patterns: {
--     strip_from_output: {
--       brochure_language: [...],
--       superlatives: [...],
--       generic_marketing: [...],
--       ai_tells: [...]
--     },
--     generation_constraints: {
--       compound_sentences: ["mens", "selvom", "når", "da"]  <- Prompt-only, never strip!
--     }
--   }
-- =====================================================

-- Step 1: Migrate existing avoid_patterns data
UPDATE business_brand_profile
SET voice_guardrails = jsonb_set(
  voice_guardrails,
  '{avoid_patterns}',
  jsonb_build_object(
    'strip_from_output', jsonb_build_object(
      'brochure_language', COALESCE(voice_guardrails->'avoid_patterns'->'brochure_language', '[]'::jsonb),
      'superlatives', COALESCE(voice_guardrails->'avoid_patterns'->'superlatives', '[]'::jsonb),
      'generic_marketing', COALESCE(voice_guardrails->'avoid_patterns'->'generic_marketing', '[]'::jsonb),
      'ai_tells', COALESCE(voice_guardrails->'avoid_patterns'->'ai_tells', '[]'::jsonb),
      'formulaic_wallpaper', COALESCE(voice_guardrails->'avoid_patterns'->'formulaic_wallpaper', '[]'::jsonb)
    ),
    'generation_constraints', jsonb_build_object(
      'compound_sentences', COALESCE(voice_guardrails->'avoid_patterns'->'compound_sentences', '[]'::jsonb)
    )
  )
)
WHERE voice_guardrails ? 'avoid_patterns'
  AND voice_guardrails->'avoid_patterns' IS NOT NULL
  AND NOT (voice_guardrails->'avoid_patterns' ? 'strip_from_output'); -- Only migrate if not already in new format

-- Step 2: Verification query (run this manually to check results)
-- SELECT 
--   business_id,
--   jsonb_pretty(voice_guardrails->'avoid_patterns') as avoid_patterns_structure
-- FROM business_brand_profile
-- WHERE voice_guardrails ? 'avoid_patterns'
-- LIMIT 5;

-- Step 3: Add comment to document the structure
COMMENT ON COLUMN business_brand_profile.voice_guardrails IS 
'V5.1 guardrails structure (flattened for fast validation). Updated v5.1.3 to split avoid_patterns:
{
  "never_say": ["word → replacement"],
  "content_exclusions": ["topic to avoid"],
  "factual_constraints": ["rule"],
  "seasonal_notes": ["month-range: rule"],
  "forbidden_phrases": ["phrase"],
  "technical_terms": ["term"],
  "weather_cliches": ["cliché"],
  "avoid_patterns": {
    "strip_from_output": {
      "brochure_language": ["phrase"],
      "superlatives": ["word"],
      "generic_marketing": ["phrase"],
      "ai_tells": ["pattern"]
    },
    "generation_constraints": {
      "compound_sentences": ["mens", "når", "da"] -- PROMPT ONLY, never strip!
    }
  }
}';
