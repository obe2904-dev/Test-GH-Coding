-- Fix Missing Columns and Content Strategy
-- Created: 2026-06-15
-- Purpose: Add missing inferred_content_type column and check content_strategy

-- ==============================================================================
-- PART 1: Add missing column to daily_suggestions
-- ==============================================================================

-- Add inferred_content_type column (from PHASE1-QUICKSTART.sql)
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;

-- Add validation_result column if also missing
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation 
  ON daily_suggestions USING GIN (validation_result);
  
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type 
  ON daily_suggestions(inferred_content_type);

-- ==============================================================================
-- PART 2: Check and diagnose content_strategy issue
-- ==============================================================================

-- Check if Café Faust has content_strategy
SELECT 
  business_name,
  (brand_voice IS NOT NULL) as has_brand_voice,
  (brand_voice->>'content_strategy') IS NOT NULL as has_content_strategy,
  jsonb_pretty(brand_voice->'content_strategy') as content_strategy
FROM business_brand_profile 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ==============================================================================
-- PART 3: Verify column was added
-- ==============================================================================

SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'daily_suggestions' 
  AND column_name IN ('inferred_content_type', 'validation_result')
ORDER BY column_name;

-- ==============================================================================
-- PART 4: Check if any existing businesses have content_strategy
-- ==============================================================================

SELECT 
  business_name,
  (brand_voice->>'content_strategy') IS NOT NULL as has_content_strategy,
  brand_voice->'content_strategy'->'goal_blend' as goal_blend,
  brand_voice->'content_strategy'->'content_category_weights' as content_weights
FROM business_brand_profile 
WHERE brand_voice IS NOT NULL
  AND brand_voice->>'content_strategy' IS NOT NULL
LIMIT 5;
