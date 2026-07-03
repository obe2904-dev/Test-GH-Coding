-- Check if business_identity_persona exists in nested structure
-- (to see if we need to re-run the migration UPDATE)
SELECT 
  business_id,
  
  -- Check if persona exists in nested structure but not in flattened column
  brand_profile_v5->'identity'->>'business_character' as nested_persona,
  business_identity_persona as flattened_persona,
  
  CASE 
    WHEN brand_profile_v5->'identity'->>'business_character' IS NOT NULL 
         AND business_identity_persona IS NULL 
    THEN '⚠️ NEEDS MIGRATION'
    WHEN business_identity_persona IS NOT NULL 
    THEN '✅ MIGRATED'
    ELSE '⚠️ No persona data'
  END as migration_status

FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
