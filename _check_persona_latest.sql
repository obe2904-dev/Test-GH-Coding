-- Check latest AI summary-based persona with enhanced constraints
SELECT 
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as persona,
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count' as word_count,
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'menu_summaries_count' as menu_summaries,
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'generated_at' as generated_at,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
