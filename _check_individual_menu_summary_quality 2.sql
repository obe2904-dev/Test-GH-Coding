-- ===================================================================
-- Check Individual Menu Summary Quality After Prompt Update
-- ===================================================================
-- Purpose: Verify that menu_results_v2.ai_summary contains objective,
--          category-focused descriptions without contamination
-- Execute: After regenerating menus with new prompts
-- ===================================================================

SELECT 
  business_id,
  service_period_name,
  source_url,
  
  -- Show the AI summary
  ai_summary,
  
  -- Quality checks
  CASE 
    WHEN ai_summary ILIKE '%lækre%' 
      OR ai_summary ILIKE '%vidunderlig%' 
      OR ai_summary ILIKE '%fantastisk%'
      OR ai_summary ILIKE '%hyggelig%'
      OR ai_summary ILIKE '%afslappet%'
    THEN '❌ SUBJECTIVE LANGUAGE'
    ELSE '✅ Objective'
  END as subjective_check,
  
  CASE 
    WHEN ai_summary ILIKE '%familier%' 
      OR ai_summary ILIKE '%par%'
      OR ai_summary ILIKE '%børn%'
      OR ai_summary ILIKE '%henvender sig til%'
    THEN '❌ TARGET AUDIENCE'
    ELSE '✅ No audience'
  END as audience_check,
  
  CASE 
    WHEN ai_summary ILIKE '%atmosfære%' 
      OR ai_summary ILIKE '%stemning%'
    THEN '❌ ATMOSPHERE'
    ELSE '✅ No atmosphere'
  END as atmosphere_check,
  
  -- Count bullets
  (LENGTH(ai_summary) - LENGTH(REPLACE(ai_summary, '•', ''))) as bullet_count,
  
  -- Word count (approximate)
  ARRAY_LENGTH(STRING_TO_ARRAY(ai_summary, ' '), 1) as word_count,
  
  created_at
  
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' -- Café Faust
ORDER BY service_period_name;

-- ===================================================================
-- Expected Results After Regeneration:
-- ===================================================================
-- ✅ subjective_check: All "✅ Objective"
-- ✅ audience_check: All "✅ No audience"
-- ✅ atmosphere_check: All "✅ No atmosphere"
-- ✅ bullet_count: 4-5 bullets
-- ✅ word_count: 80-150 words
-- ✅ Content: Category-focused (smørrebrød, hovedretter, desserter)
-- ❌ Content: NO specific dish names (Pariserbøf, Faustburger)
