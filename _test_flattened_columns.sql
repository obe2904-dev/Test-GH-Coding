-- ═══════════════════════════════════════════════════════════════════════════
-- Test Flattened Brand Profile Columns
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to verify data and performance

-- 1. Show current data in flattened columns
SELECT 
  business_id,
  
  -- Check voice_guardrails
  CASE 
    WHEN voice_guardrails IS NULL THEN '❌ NULL'
    WHEN voice_guardrails = '{}'::jsonb THEN '⚠️ Empty'
    ELSE '✅ Populated'
  END as guardrails_status,
  
  jsonb_array_length(voice_guardrails->'forbidden_phrases') as forbidden_count,
  jsonb_array_length(voice_guardrails->'never_say') as never_say_count,
  
  -- Check business_identity_persona
  CASE 
    WHEN business_identity_persona IS NULL THEN '❌ NULL'
    WHEN LENGTH(business_identity_persona) = 0 THEN '⚠️ Empty'
    ELSE '✅ Populated'
  END as persona_status,
  
  LENGTH(business_identity_persona) as persona_chars,
  
  -- Check examples
  jsonb_array_length(enhanced_social_examples) as enhanced_examples_count,
  jsonb_array_length(social_writing_examples) as simple_examples_count

FROM business_brand_profile
LIMIT 5;

-- 2. Performance test: Compare nested vs flattened access
-- This shows the query plan difference
EXPLAIN ANALYZE
SELECT 
  business_id,
  voice_guardrails->'forbidden_phrases' as guardrails_direct,
  business_identity_persona as persona_direct
FROM business_brand_profile
WHERE business_id IS NOT NULL
LIMIT 1;

-- 3. Show sample guardrails data
SELECT 
  business_id,
  voice_guardrails->'forbidden_phrases' as forbidden_phrases,
  voice_guardrails->'never_say' as never_say,
  LEFT(business_identity_persona, 100) || '...' as persona_preview
FROM business_brand_profile
WHERE voice_guardrails != '{}'::jsonb
   OR business_identity_persona IS NOT NULL
LIMIT 2;
