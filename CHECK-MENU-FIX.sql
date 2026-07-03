-- Check if menu items are now in the persona (UPDATED PATH for V5.2)

SELECT 
  brand_profile_v5->'business_identity'->>'system_persona' as persona,
  brand_profile_v5->'business_identity'->'metadata'->>'menu_summaries_count' as menu_summaries,
  brand_profile_v5->'business_identity'->'metadata'->>'word_count' as word_count,
  brand_profile_v5->'business_identity'->'metadata'->>'generated_at' as generated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
