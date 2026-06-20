-- Check the NEW enhanced persona (after fixing data pipeline)

SELECT 
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as "NEW Enhanced Persona",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count' as "Word Count",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'signature_items_count' as "Signature Items",
  brand_profile_v5->'generated_at' as "Generated At"
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY updated_at DESC
LIMIT 1;
