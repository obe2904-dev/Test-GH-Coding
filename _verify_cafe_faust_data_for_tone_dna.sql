-- Verify all data sources for Café Faust tone DNA generation
-- Run this to check what data is actually available

-- 1. Location Intelligence (should have waterfront, city_centre - NOT student/tourist)
SELECT 
  business_id,
  neighborhood,
  neighborhood_character,
  area_type,
  category_scores,
  location_marketing_hooks
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Menu Overview Summary (signature themes, fusion patterns, price)
SELECT 
  business_id,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->'signature_themes' as signature_themes,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'cross_menu_summary' as cross_menu_summary,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'gastronomic_profile' as gastronomic_profile,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'overall_avg_price' as overall_avg_price,
  brand_profile_v5->'layer_0_intelligence'->'menu_overview'->>'total_items' as total_items
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Business Profile (Om Os text for owner voice analysis)
SELECT 
  business_id,
  long_description as om_os_text,
  character_length(long_description) as om_os_length
FROM business_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Current Brand Profile V5 (check if tone DNA exists)
SELECT 
  business_id,
  brand_profile_v5->'voice'->>'tone_rules' as has_legacy_tone_rules,
  brand_profile_v5->'voice'->'tone_dna' IS NOT NULL as has_tone_dna,
  brand_profile_v5->'voice'->'tone_dna'->>'recommended_tone' as current_tone_recommendation
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Business basic info (city, name)
SELECT 
  b.id,
  b.name as business_name,
  bl.city,
  bl.postal_code,
  b.local_location_reference
FROM businesses b
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 6. Check category_scores breakdown (verify waterfront vs student)
SELECT 
  business_id,
  jsonb_pretty(category_scores) as category_scores_detailed
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 7. Programme Profiles (audience segmentation per programme)
SELECT 
  business_id,
  brand_profile_v5->'layer_1_programmes' as programmes
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 8. Check how many programmes exist
SELECT 
  business_id,
  jsonb_array_length(brand_profile_v5->'layer_1_programmes') as programme_count,
  jsonb_agg(prog->>'name') as programme_names
FROM business_brand_profile,
     jsonb_array_elements(brand_profile_v5->'layer_1_programmes') as prog
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY business_id;
