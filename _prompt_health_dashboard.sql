-- Prompt Health Dashboard
-- Monitor brand profile completeness and prompt quality across all businesses
-- Use this to identify businesses needing profile regeneration or optimization

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEW: prompt_health_metrics
-- Aggregates V5 brand profile completeness and estimates prompt size/quality
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW prompt_health_metrics AS
SELECT 
  bp.business_id,
  b.business_name,
  
  -- V5 Tone DNA completeness
  CASE 
    WHEN bp.brand_profile_v5->'voice'->'tone_dna' IS NOT NULL THEN 'tone_dna' 
    ELSE 'legacy' 
  END as prompt_path,
  
  CASE 
    WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' IS NOT NULL 
      AND bp.brand_profile_v5->'voice'->'tone_dna'->>'strategic_summary' IS NOT NULL
      AND bp.brand_profile_v5->'voice'->'tone_dna'->'tone_do_list' IS NOT NULL
      AND bp.brand_profile_v5->'voice'->'tone_dna'->'location_driver' IS NOT NULL
      AND bp.brand_profile_v5->'voice'->'tone_dna'->'culinary_character' IS NOT NULL
      AND bp.brand_profile_v5->'voice'->'tone_dna'->'owner_voice' IS NOT NULL
    THEN 'complete' 
    WHEN bp.brand_profile_v5->'voice'->'tone_dna' IS NOT NULL THEN 'partial'
    ELSE 'missing' 
  END as tone_dna_health,
  
  -- Component availability
  CASE WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' IS NOT NULL THEN '✅' ELSE '❌' END as has_recommended_tone,
  CASE WHEN bp.brand_profile_v5->'voice'->'tone_dna'->>'strategic_summary' IS NOT NULL THEN '✅' ELSE '❌' END as has_strategic_summary,
  CASE WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'location_driver' IS NOT NULL THEN '✅' ELSE '❌' END as has_location_driver,
  CASE WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'culinary_character' IS NOT NULL THEN '✅' ELSE '❌' END as has_culinary_character,
  CASE WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'owner_voice' IS NOT NULL THEN '✅' ELSE '❌' END as has_owner_voice,
  
  -- Example counts
  jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_social_examples') as good_examples_count,
  jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_avoid_examples') as avoid_examples_count,
  
  -- Vocabulary size (indicator of prompt bloat)
  COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'vocabulary'->'prefer'), 0) as prefer_vocab_count,
  COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'vocabulary'->'avoid'), 0) as avoid_vocab_count,
  
  -- Rule counts
  COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'tone_dna'->'tone_do_list'), 0) as tone_do_count,
  COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'tone_dna'->'tone_dont_list'), 0) as tone_dont_count,
  
  -- Estimated prompt size category
  CASE 
    WHEN jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_social_examples') > 8 
      OR COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'vocabulary'->'avoid'), 0) > 15
    THEN 'OVERSIZED 🔴'
    WHEN jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_social_examples') < 3
      AND bp.brand_profile_v5->'voice'->'tone_dna' IS NULL
    THEN 'UNDERSIZED 🟡'
    ELSE 'OPTIMAL ✅'
  END as size_category,
  
  -- Quality score (0-100)
  (
    -- Tone DNA completeness (40 points)
    CASE 
      WHEN bp.brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' IS NOT NULL 
        AND bp.brand_profile_v5->'voice'->'tone_dna'->>'strategic_summary' IS NOT NULL
        AND bp.brand_profile_v5->'voice'->'tone_dna'->'tone_do_list' IS NOT NULL
      THEN 40
      WHEN bp.brand_profile_v5->'voice'->'tone_dna' IS NOT NULL THEN 20
      ELSE 0
    END
    +
    -- Examples (30 points)
    CASE 
      WHEN jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_social_examples') >= 5 THEN 20 ELSE 0 
    END
    +
    CASE 
      WHEN jsonb_array_length(bp.brand_profile_v5->'voice'->'enhanced_avoid_examples') >= 3 THEN 10 ELSE 0 
    END
    +
    -- Vocabulary balance (20 points)
    CASE 
      WHEN COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'vocabulary'->'prefer'), 0) >= 3 
        AND COALESCE(jsonb_array_length(bp.brand_profile_v5->'voice'->'vocabulary'->'avoid'), 0) BETWEEN 3 AND 10 
      THEN 20 
      ELSE 10
    END
    +
    -- Identity components (10 points)
    CASE 
      WHEN bp.brand_profile_v5->'identity'->>'communication_goal' IS NOT NULL 
        AND bp.brand_profile_v5->'identity'->>'emotional_promise' IS NOT NULL
      THEN 10
      ELSE 5
    END
  ) as quality_score,
  
  -- Last updated
  bp.updated_at as profile_updated_at

FROM business_brand_profile bp
JOIN businesses b ON bp.business_id = b.id
WHERE bp.brand_profile_v5 IS NOT NULL
ORDER BY quality_score DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY: Find businesses needing Tone DNA generation
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON VIEW prompt_health_metrics IS 
'Monitors brand profile completeness for prompt quality. 
Use to identify businesses needing profile regeneration or optimization.
Quality score 80+ = excellent, 60-79 = good, 40-59 = needs work, <40 = critical';

-- Usage examples:

-- 1. Find all businesses without Tone DNA
-- SELECT business_name, tone_dna_health, quality_score 
-- FROM prompt_health_metrics 
-- WHERE prompt_path = 'legacy'
-- ORDER BY quality_score DESC;

-- 2. Find oversized prompts (potential attention dilution)
-- SELECT business_name, size_category, good_examples_count, avoid_vocab_count
-- FROM prompt_health_metrics 
-- WHERE size_category LIKE 'OVERSIZED%'
-- ORDER BY avoid_vocab_count DESC;

-- 3. Find incomplete Tone DNA profiles
-- SELECT business_name, has_recommended_tone, has_strategic_summary, has_location_driver, has_owner_voice
-- FROM prompt_health_metrics 
-- WHERE tone_dna_health = 'partial';

-- 4. Overall health summary
-- SELECT 
--   prompt_path,
--   tone_dna_health,
--   COUNT(*) as count,
--   ROUND(AVG(quality_score), 1) as avg_quality_score
-- FROM prompt_health_metrics
-- GROUP BY prompt_path, tone_dna_health
-- ORDER BY avg_quality_score DESC;
