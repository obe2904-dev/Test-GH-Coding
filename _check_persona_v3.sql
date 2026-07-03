-- Check new AI summary-based persona for Café Faust
SELECT 
  brand_profile_v5 -> 'business_identity' ->> 'system_persona' AS persona,
  brand_profile_v5 -> 'business_identity' -> 'metadata' ->> 'word_count' AS word_count,
  brand_profile_v5 -> 'business_identity' -> 'metadata' ->> 'menu_summaries_count' AS menu_summaries_count,
  brand_profile_v5 -> 'business_identity' -> 'metadata' ->> 'programmes_count' AS programmes_count,
  brand_profile_v5 -> 'business_identity' -> 'metadata' ->> 'city_context_used' AS city_context_used,
  brand_profile_v5 -> 'business_identity' -> 'metadata' ->> 'generated_at' AS generated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
