-- Comprehensive check: Category scores vs analyzed categories for Café Faust
-- Shows which categories scored >= 60% and whether they've been analyzed

WITH category_scores_expanded AS (
  SELECT 
    key as category,
    value::text::numeric as score
  FROM business_location_intelligence,
    jsonb_each(category_scores)
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
),
analyzed_categories AS (
  SELECT 
    key as category,
    CASE 
      WHEN value IS NOT NULL THEN true
      ELSE false
    END as has_analysis
  FROM business_location_intelligence,
    jsonb_each(concept_fit_by_category)
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
)
SELECT 
  cs.category,
  cs.score,
  CASE 
    WHEN cs.score >= 60 THEN '✅ Should analyze'
    WHEN cs.score >= 40 THEN '⚠️  Close to threshold'
    ELSE '❌ Below threshold'
  END as threshold_status,
  COALESCE(ac.has_analysis, false) as is_analyzed,
  CASE 
    WHEN cs.score >= 60 AND COALESCE(ac.has_analysis, false) THEN '✅ Analyzed'
    WHEN cs.score >= 60 AND NOT COALESCE(ac.has_analysis, false) THEN '❌ MISSING ANALYSIS'
    WHEN cs.score < 60 AND COALESCE(ac.has_analysis, false) THEN '⚠️  Analyzed despite low score'
    ELSE '—'
  END as analysis_status
FROM category_scores_expanded cs
LEFT JOIN analyzed_categories ac ON cs.category = ac.category
ORDER BY cs.score DESC;

-- Summary stats
SELECT 
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE score >= 60) as categories_above_60,
  COUNT(*) FILTER (WHERE score >= 40 AND score < 60) as categories_40_to_60,
  COUNT(*) FILTER (WHERE score < 40) as categories_below_40
FROM (
  SELECT value::text::numeric as score
  FROM business_location_intelligence,
    jsonb_each(category_scores)
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
) scores;

-- Show analyzed categories count
SELECT 
  COUNT(*) as total_analyzed_categories
FROM business_location_intelligence,
  jsonb_each(concept_fit_by_category)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Raw data for verification
SELECT 
  area_type,
  category_scores,
  jsonb_object_keys(concept_fit_by_category) as analyzed_categories
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
