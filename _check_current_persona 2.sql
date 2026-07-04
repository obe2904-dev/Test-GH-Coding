-- Check current persona for Café Faust
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

SELECT 
  b.name,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as persona,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->'metadata' as metadata,
  length(bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona') as char_count
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
