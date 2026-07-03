-- Check the most recent brand profile generation for Faust
SELECT 
  b.name,
  bp.quality_status,
  bp.tone_model->>'version' as tone_model_version,
  bp.tone_model->>'confidence' as tone_model_confidence,
  jsonb_array_length(bp.tone_model->'primary_keywords') as keywords_count,
  jsonb_array_length(bp.tone_model->'writing_rules') as rules_count,
  bp.error_log->'summary' as error_summary,
  bp.updated_at,
  CASE 
    WHEN bp.tone_model IS NULL THEN 'NULL (v4.7.3 sanitizer returned null)'
    ELSE 'Valid structure'
  END as tone_model_status
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8'
ORDER BY bp.updated_at DESC
LIMIT 1;
