-- =====================================================
-- VERIFY business_brand_profile FIELD STATUS
-- Date: 2026-06-23
-- Purpose: Check if "actively used" fields are actually empty in database
-- 
-- Context: V5-NULL-ACCEPTABILITY-REPORT.md marked 19 fields as "schema-only"
-- but 15+ are actively read by Edge Functions. Need to verify if they
-- contain data or are just NULL pollution.
-- =====================================================

-- Quick summary of all 15 fields
SELECT 
  COUNT(*) as total_brand_profiles,
  
  -- Identity/Classification fields
  COUNT(business_model_type) as has_business_model_type,
  COUNT(audience_breadth) as has_audience_breadth,
  COUNT(classification_rationale) as has_classification_rationale,
  COUNT(brand_essence_elaboration) as has_brand_essence_elaboration,
  COUNT(identity_keywords) as has_identity_keywords,
  COUNT(values) as has_values,
  
  -- Voice fields
  COUNT(voice_style) as has_voice_style,
  COUNT(humor_level) as has_humor_level,
  
  -- Decision/Strategy fields
  COUNT(cta_style) as has_cta_style,
  COUNT(commercial_baseline_mode) as has_commercial_baseline_mode,
  COUNT(commercial_strategy_reasoning) as has_commercial_strategy_reasoning,
  COUNT(content_pillars_jsonb) as has_content_pillars_jsonb,
  COUNT(content_strategy_confirmed) as has_content_strategy_confirmed,
  
  -- Quality/Other
  COUNT(quality_status) as has_quality_status,
  COUNT(certifications) as has_certifications
  
FROM business_brand_profile;

-- =====================================================
-- DETAILED CHECKS - Run individually for investigation
-- =====================================================

-- Check business_model_type (used in get-quick-suggestions)
SELECT 
  business_id,
  business_model_type,
  updated_at
FROM business_brand_profile
WHERE business_model_type IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check audience_breadth (used in get-quick-suggestions)
SELECT 
  business_id,
  audience_breadth,
  updated_at
FROM business_brand_profile
WHERE audience_breadth IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check voice_style (used in get-weekly-strategy)
SELECT 
  business_id,
  voice_style,
  updated_at
FROM business_brand_profile
WHERE voice_style IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check cta_style (used in analyze-concept-fit)
SELECT 
  business_id,
  cta_style,
  updated_at
FROM business_brand_profile
WHERE cta_style IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check commercial_baseline_mode (used in commercial-mode logic)
SELECT 
  business_id,
  commercial_baseline_mode,
  updated_at
FROM business_brand_profile
WHERE commercial_baseline_mode IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check identity_keywords (used in generate-text-from-idea)
SELECT 
  business_id,
  identity_keywords,
  updated_at
FROM business_brand_profile
WHERE identity_keywords IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check humor_level (used in get-quick-suggestions)
SELECT 
  business_id,
  humor_level,
  updated_at
FROM business_brand_profile
WHERE humor_level IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check content_strategy_confirmed (used in get-quick-suggestions)
SELECT 
  business_id,
  content_strategy_confirmed,
  updated_at
FROM business_brand_profile
WHERE content_strategy_confirmed IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check values (used in analyze-concept-fit)
SELECT 
  business_id,
  values,
  updated_at
FROM business_brand_profile
WHERE values IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check certifications (used in strategy-feasibility-validator)
SELECT 
  business_id,
  certifications,
  updated_at
FROM business_brand_profile
WHERE certifications IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check quality_status (used in brand-profile-generator)
SELECT 
  business_id,
  quality_status,
  updated_at
FROM business_brand_profile
WHERE quality_status IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check content_pillars_jsonb (used in brand-profile-generator)
SELECT 
  business_id,
  content_pillars_jsonb,
  updated_at
FROM business_brand_profile
WHERE content_pillars_jsonb IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check brand_essence_elaboration (used in brand-profile-generator V4)
SELECT 
  business_id,
  brand_essence_elaboration,
  updated_at
FROM business_brand_profile
WHERE brand_essence_elaboration IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check classification_rationale (used in brand-profile-generator)
SELECT 
  business_id,
  classification_rationale,
  updated_at
FROM business_brand_profile
WHERE classification_rationale IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Check commercial_strategy_reasoning (used in brand-profile-generator)
SELECT 
  business_id,
  commercial_strategy_reasoning,
  updated_at
FROM business_brand_profile
WHERE commercial_strategy_reasoning IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- =====================================================
-- V4 vs V5 GENERATOR STATUS CHECK
-- =====================================================

-- Check which generator is being used (V4 vs V5)
-- V5 writes to brand_profile_v5 column
-- V4 writes to legacy JSONB columns

SELECT 
  COUNT(*) as total_profiles,
  COUNT(brand_profile_v5) as has_v5_data,
  COUNT(CASE WHEN brand_profile_v5 IS NOT NULL THEN 1 END) as v5_count,
  COUNT(CASE WHEN brand_profile_v5 IS NULL THEN 1 END) as v4_only_count,
  
  -- Check if V4 fields are still being written
  COUNT(brand_essence_elaboration) as has_v4_brand_essence_elab,
  COUNT(cta_style) as has_v4_cta_style,
  COUNT(quality_status) as has_v4_quality_status
  
FROM business_brand_profile;

-- Most recent profile generations (which generator was used?)
SELECT 
  business_id,
  updated_at,
  CASE 
    WHEN brand_profile_v5 IS NOT NULL THEN 'V5'
    ELSE 'V4 or Legacy'
  END as generator_version,
  brand_essence_elaboration IS NOT NULL as has_v4_fields,
  commercial_baseline_mode IS NOT NULL as has_v4_commercial
FROM business_brand_profile
ORDER BY updated_at DESC
LIMIT 20;

-- =====================================================
-- NULL POLLUTION CHECK
-- =====================================================

-- Find profiles where code reads fields but they're NULL
-- (causing prompt pollution)

SELECT 
  business_id,
  
  -- Fields read by get-quick-suggestions but NULL
  CASE WHEN business_model_type IS NULL THEN 'NULL' ELSE 'HAS DATA' END as business_model_type_status,
  CASE WHEN audience_breadth IS NULL THEN 'NULL' ELSE 'HAS DATA' END as audience_breadth_status,
  CASE WHEN identity_keywords IS NULL THEN 'NULL' ELSE 'HAS DATA' END as identity_keywords_status,
  CASE WHEN humor_level IS NULL THEN 'NULL' ELSE 'HAS DATA' END as humor_level_status,
  CASE WHEN content_strategy_confirmed IS NULL THEN 'NULL' ELSE 'HAS DATA' END as content_confirmed_status,
  
  -- Fields read by other functions but NULL
  CASE WHEN voice_style IS NULL THEN 'NULL' ELSE 'HAS DATA' END as voice_style_status,
  CASE WHEN cta_style IS NULL THEN 'NULL' ELSE 'HAS DATA' END as cta_style_status,
  CASE WHEN commercial_baseline_mode IS NULL THEN 'NULL' ELSE 'HAS DATA' END as commercial_mode_status,
  
  updated_at
  
FROM business_brand_profile
ORDER BY updated_at DESC
LIMIT 20;

-- =====================================================
-- RECOMMENDATION QUERIES
-- =====================================================

-- For each field, calculate:
-- 1. Total NULL count (prompt pollution potential)
-- 2. Total NON-NULL count (field has value)
-- 3. Percentage populated

SELECT 
  'business_model_type' as field_name,
  COUNT(*) as total,
  COUNT(business_model_type) as populated,
  COUNT(*) - COUNT(business_model_type) as null_count,
  ROUND(100.0 * COUNT(business_model_type) / NULLIF(COUNT(*), 0), 2) as populated_pct
FROM business_brand_profile

UNION ALL

SELECT 
  'audience_breadth',
  COUNT(*),
  COUNT(audience_breadth),
  COUNT(*) - COUNT(audience_breadth),
  ROUND(100.0 * COUNT(audience_breadth) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'voice_style',
  COUNT(*),
  COUNT(voice_style),
  COUNT(*) - COUNT(voice_style),
  ROUND(100.0 * COUNT(voice_style) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'cta_style',
  COUNT(*),
  COUNT(cta_style),
  COUNT(*) - COUNT(cta_style),
  ROUND(100.0 * COUNT(cta_style) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'commercial_baseline_mode',
  COUNT(*),
  COUNT(commercial_baseline_mode),
  COUNT(*) - COUNT(commercial_baseline_mode),
  ROUND(100.0 * COUNT(commercial_baseline_mode) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'identity_keywords',
  COUNT(*),
  COUNT(identity_keywords),
  COUNT(*) - COUNT(identity_keywords),
  ROUND(100.0 * COUNT(identity_keywords) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'humor_level',
  COUNT(*),
  COUNT(humor_level),
  COUNT(*) - COUNT(humor_level),
  ROUND(100.0 * COUNT(humor_level) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'content_strategy_confirmed',
  COUNT(*),
  COUNT(content_strategy_confirmed),
  COUNT(*) - COUNT(content_strategy_confirmed),
  ROUND(100.0 * COUNT(content_strategy_confirmed) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'values',
  COUNT(*),
  COUNT(values),
  COUNT(*) - COUNT(values),
  ROUND(100.0 * COUNT(values) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'certifications',
  COUNT(*),
  COUNT(certifications),
  COUNT(*) - COUNT(certifications),
  ROUND(100.0 * COUNT(certifications) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'quality_status',
  COUNT(*),
  COUNT(quality_status),
  COUNT(*) - COUNT(quality_status),
  ROUND(100.0 * COUNT(quality_status) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'content_pillars_jsonb',
  COUNT(*),
  COUNT(content_pillars_jsonb),
  COUNT(*) - COUNT(content_pillars_jsonb),
  ROUND(100.0 * COUNT(content_pillars_jsonb) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'brand_essence_elaboration',
  COUNT(*),
  COUNT(brand_essence_elaboration),
  COUNT(*) - COUNT(brand_essence_elaboration),
  ROUND(100.0 * COUNT(brand_essence_elaboration) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'classification_rationale',
  COUNT(*),
  COUNT(classification_rationale),
  COUNT(*) - COUNT(classification_rationale),
  ROUND(100.0 * COUNT(classification_rationale) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

UNION ALL

SELECT 
  'commercial_strategy_reasoning',
  COUNT(*),
  COUNT(commercial_strategy_reasoning),
  COUNT(*) - COUNT(commercial_strategy_reasoning),
  ROUND(100.0 * COUNT(commercial_strategy_reasoning) / NULLIF(COUNT(*), 0), 2)
FROM business_brand_profile

ORDER BY populated_pct DESC;
