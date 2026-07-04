-- ═══════════════════════════════════════════════════════════════════════════
-- Check if Brand Profile Flattening Migrations are Deployed
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to verify deployment status

-- Check if Migration 1 columns exist (flatten_brand_examples)
SELECT 
  'Migration 20260612000001' as migration,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ DEPLOYED'
    ELSE '❌ NOT DEPLOYED (missing columns)'
  END as status,
  string_agg(column_name, ', ') as found_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name IN ('enhanced_social_examples', 'enhanced_avoid_examples', 'social_writing_examples')

UNION ALL

-- Check if Migration 2 columns exist (flatten_voice_guardrails)
SELECT 
  'Migration 20260612000002' as migration,
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ DEPLOYED'
    ELSE '❌ NOT DEPLOYED (missing columns)'
  END as status,
  string_agg(column_name, ', ') as found_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name IN ('voice_guardrails', 'business_identity_persona');

-- Show actual columns for business_brand_profile
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name IN (
    'enhanced_social_examples', 
    'enhanced_avoid_examples', 
    'social_writing_examples',
    'voice_guardrails',
    'business_identity_persona'
  )
ORDER BY column_name;
