-- Check what's actually stored in the database for suggestion 59
SELECT 
  id,
  title,
  uploaded_photo_url,
  photo_analysis,
  LENGTH(uploaded_photo_url) as url_length,
  jsonb_typeof(photo_analysis) as analysis_type,
  photo_analysis->>'overallFeedback' as feedback_preview
FROM daily_suggestions 
WHERE id = 59;

-- Also check a few recent suggestions
SELECT 
  id,
  title,
  uploaded_photo_url IS NOT NULL as has_photo_url,
  photo_analysis IS NOT NULL as has_analysis,
  created_at
FROM daily_suggestions 
ORDER BY created_at DESC
LIMIT 10;
