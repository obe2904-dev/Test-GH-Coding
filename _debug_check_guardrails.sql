-- Debug: Check guardrails in brand_profile_v5
SELECT 
  business_id,
  brand_profile_v5->'guardrails'->'forbidden_phrases' as forbidden_phrases,
  brand_profile_v5->'guardrails'->'technical_terms' as technical_terms,
  brand_profile_v5->'guardrails'->'weather_cliches' as weather_cliches,
  jsonb_array_length(brand_profile_v5->'guardrails'->'forbidden_phrases') as forbidden_count,
  jsonb_array_length(brand_profile_v5->'guardrails'->'technical_terms') as technical_count,
  jsonb_array_length(brand_profile_v5->'guardrails'->'weather_cliches') as weather_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
