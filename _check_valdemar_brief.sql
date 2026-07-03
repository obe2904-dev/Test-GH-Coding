-- Check Restaurant Valdemar marketing brief for V5.9 validation results

SELECT 
  b.name AS business_name,
  LENGTH(bbp.marketing_manager_brief) AS brief_length,
  bbp.marketing_manager_brief AS brief_text,
  jsonb_array_length(bbp.voice_guardrails->'never_say') AS never_say_count,
  jsonb_array_length(bbp.voice_guardrails->'generic_marketing') AS generic_marketing_count,
  jsonb_array_length(bbp.voice_guardrails->'superlatives') AS superlatives_count,
  bbp.voice_guardrails->'never_say' AS forbidden_never_say,
  bbp.voice_guardrails->'generic_marketing' AS forbidden_generic,
  bbp.voice_guardrails->'superlatives' AS forbidden_superlatives
FROM businesses b
JOIN business_brand_profile bbp ON bbp.business_id = b.id
WHERE b.id = '07a5a2c7-4aa8-49b3-a125-6f687caf0f28';

-- Sample text from brief (first 500 chars)
SELECT 
  SUBSTRING(marketing_manager_brief, 1, 500) AS brief_preview
FROM business_brand_profile
WHERE business_id = '07a5a2c7-4aa8-49b3-a125-6f687caf0f28';
