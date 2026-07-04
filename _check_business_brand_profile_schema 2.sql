-- Check what columns actually exist in business_brand_profile table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;

-- Check if our needed columns exist
SELECT 
  '✅ Required Columns' AS check_name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'brand_profile_v5') as has_brand_profile_v5,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'brand_essence') as has_brand_essence,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'business_character') as has_business_character,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'target_type_mix') as has_target_type_mix,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'revenue_drivers') as has_revenue_drivers;
