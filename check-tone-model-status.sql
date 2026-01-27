-- Quick Tone Model v2 Status Check
-- Run this in Supabase SQL Editor to verify deployment

-- ============================================
-- 1. Check if Migration Applied
-- ============================================

-- Check if tone_model column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'business_brand_profile' 
        AND column_name = 'tone_model'
    ) THEN '✅ Column exists'
    ELSE '❌ Column missing - run migration'
  END as column_status;

-- Check if v2 constraint exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tone_model_valid_structure_v2'
    ) THEN '✅ V2 constraint active'
    ELSE '❌ V2 constraint missing - run migration'
  END as constraint_status;

-- ============================================
-- 2. Check Café Faust tone_model Status
-- ============================================

SELECT 
  b.name,
  bp.business_id,
  bp.tone_model IS NOT NULL as has_tone_model,
  bp.tone_model->>'version' as version,
  bp.tone_model->>'language' as language,
  bp.tone_model->>'confidence' as confidence,
  jsonb_array_length(bp.tone_model->'primary_keywords') as keyword_count,
  bp.tone_model->'primary_keywords' as keywords
FROM businesses b
LEFT JOIN business_brand_profile bp ON bp.business_id = b.id
WHERE b.name ILIKE '%Café Faust%'
   OR b.name ILIKE '%Faust%'
LIMIT 1;

-- ============================================
-- 3. If tone_model is NULL, Force Regeneration
-- ============================================

-- Run this to force brand profile regeneration:
-- UPDATE business_brand_profile
-- SET version_hash = NULL
-- WHERE business_id IN (
--   SELECT id FROM businesses WHERE name ILIKE '%Café Faust%'
-- );

-- Then regenerate brand profile in your app
-- New profile will have tone_model v2 with all 12 fields
