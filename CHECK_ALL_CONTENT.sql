-- Check all WHO/WHEN/WHY content (public vs internal)
SELECT 
  business_id,
  
  -- WHO
  jsonb_pretty(who_analysis) as who_public,
  jsonb_pretty(who_analysis_internal) as who_internal,
  
  -- WHEN  
  jsonb_pretty(when_analysis) as when_public,
  jsonb_pretty(when_analysis_internal) as when_internal,
  
  -- WHY
  jsonb_pretty(why_analysis) as why_public,
  jsonb_pretty(why_analysis_internal) as why_internal
  
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
