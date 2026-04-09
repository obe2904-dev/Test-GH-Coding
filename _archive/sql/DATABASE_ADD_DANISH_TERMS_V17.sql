-- Database Enhancement v17: Add Missing Danish Generic Terms
-- Date: 17. februar 2026
-- Purpose: Add critical missing generic café terms to never_say
-- Issue: Current never_say has 80 words but they're mostly English/cities

-- =============================================================================
-- ADD MISSING DANISH GENERIC TERMS TO CAFÉ FAUST
-- =============================================================================

DO $$
DECLARE
  current_words text[];
  new_words text[];
  final_words text[];
BEGIN
  -- Get current never_say words
  SELECT never_say INTO current_words
  FROM business_brand_profile
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
  
  -- Define critical Danish generic terms that are missing
  new_words := ARRAY[
    -- Generic invitation phrases (the main culprits)
    'kom forbi',
    'kom indenfor',
    'kom og nyd',
    'kom forbi og nyd',
    'kom og smag',
    
    -- Generic enjoyment words
    'nyd',
    'nyd en kop',
    'nyd vores',
    'nyd måltidet',
    
    -- Generic café terms
    'kaffepause',
    'hyggelig stemning',
    'hyggelig café',
    'hyggeligt sted',
    'dejlig kaffe',
    'fantastisk mad',
    'vidunderlig',
    'amazing',
    'perfekt til',
    
    -- Generic time/occasion phrases
    'til enhver lejlighed',
    'perfekt start på dagen',
    'når du har brug for',
    
    -- Generic location phrases
    'i hjertet af',
    'midt i byen',
    
    -- Generic quality claims
    'bedste kaffe',
    'bedste brunch',
    'højeste kvalitet',
    
    -- Generic welcome phrases
    'velkommen til',
    'vi glæder os til',
    'vi ser frem til'
  ];
  
  -- Merge with existing words (deduplicate)
  final_words := ARRAY(
    SELECT DISTINCT unnest(COALESCE(current_words, ARRAY[]::text[]) || new_words)
  );
  
  -- Update never_say with merged list
  UPDATE business_brand_profile
  SET never_say = final_words,
      updated_at = NOW()
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
  
  RAISE NOTICE 'Updated never_say: % existing + % new = % total words',
    COALESCE(array_length(current_words, 1), 0),
    array_length(new_words, 1),
    array_length(final_words, 1);
END $$;

-- =============================================================================
-- VERIFY THE ADDITION
-- =============================================================================

SELECT 
  business_id,
  array_length(never_say, 1) as total_words,
  
  -- Check for critical Danish terms
  'kom forbi' = ANY(never_say) as has_kom_forbi,
  'nyd' = ANY(never_say) as has_nyd,
  'kaffepause' = ANY(never_say) as has_kaffepause,
  'hyggelig stemning' = ANY(never_say) as has_hyggelig_stemning,
  
  -- Show sample of banned words (prioritize Danish)
  ARRAY(
    SELECT w FROM unnest(never_say) w 
    WHERE w ~ '[æøåÆØÅ]' 
    ORDER BY length(w) DESC 
    LIMIT 15
  ) as danish_sample,
  
  -- Show English/city names that are less valuable
  ARRAY(
    SELECT w FROM unnest(never_say) w 
    WHERE w !~ '[æøåÆØÅ]' AND w ~ '[A-Z]'
    LIMIT 10
  ) as english_sample
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- =============================================================================
-- ADD BUSINESS-TYPE-SPECIFIC GENERIC TERMS (Optional - for future)
-- =============================================================================

-- This section documents generic terms for other business types
-- (Not executed now, but useful for Phase 2: Context-Aware Anti-Patterns)

-- WINE BAR GENERIC TERMS:
-- 'skål', 'nyd vinen', 'kom og smag', 'eksklusive vine', 'ædel dråbe', 
-- 'vinoplevelse', 'sommelierens valg', 'perfekt til'

-- RESTAURANT GENERIC TERMS:
-- 'kom og spis', 'nyd måltidet', 'velkommen til bords', 'fantastisk mad',
-- 'kulinarisk oplevelse', 'gastronomi', 'smagfuld', 'exceptionel'

-- FOOD TRUCK GENERIC TERMS:
-- 'find os', 'kom og hent', 'street food', 'hurtig servering', 'on the go',
-- 'frisk tilberedt', 'følg os', 'dagens placering'

-- =============================================================================
-- OPTIONAL: CLEAN UP LESS VALUABLE ENTRIES
-- =============================================================================

-- The never_say list now has ~108 words (80 original + 28 new)
-- Some of the original 80 are English hashtags and city names that are less valuable
-- Consider removing them to keep the list focused on Danish problematic phrases

-- Example (DO NOT RUN automatically - review first):
/*
UPDATE business_brand_profile
SET never_say = ARRAY(
  SELECT w FROM unnest(never_say) w
  WHERE w !~ '^#' -- Remove hashtags
    AND w NOT IN ('Aalborg', 'CPH', 'Copenhagen', 'Esbjerg', 'Fredericia', 'Herning', 'Horsens', 'KBH')
)
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
*/

-- =============================================================================
-- EXECUTION NOTES
-- =============================================================================

-- This script:
-- ✅ ADDS 28 critical Danish generic terms
-- ✅ Preserves existing 80 words (no data loss)
-- ✅ Deduplicates (no duplicates in final list)
-- ✅ Safe - only affects Café Faust test business

-- Result: never_say grows from 80 to ~108 words
-- Most important change: NOW includes "kom forbi", "nyd", "kaffepause"

-- After running:
-- 1. Run verify-database-v17.sh again
-- 2. Should see: ✓ for all critical Danish terms
-- 3. Proceed with Phase 1 implementation

-- Execute in Supabase SQL Editor
