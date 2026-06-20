-- ============================================================================
-- CHECK SETUP COMPLETION DATA
-- ============================================================================
-- Verify what data exists for completion indicators
-- ============================================================================

-- Get your business ID
SELECT 
  id,
  name,
  website_url,
  address,
  owner_id
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check Profile: website_analyses table (status='success')
SELECT 
  'Profile - website_analyses' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✓ Should show checkmark' ELSE '✗ No checkmark' END as status
FROM website_analyses
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'success';

-- Check Menu: menu_results_v2 with status='done'
SELECT 
  'Menu - menu_results_v2' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✓ Should show checkmark' ELSE '✗ No checkmark' END as status
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done';

-- Check Location: address field populated
SELECT 
  'Location - address' as check_type,
  CASE WHEN address IS NOT NULL AND LENGTH(TRIM(address)) > 0 THEN 1 ELSE 0 END as count,
  CASE WHEN address IS NOT NULL AND LENGTH(TRIM(address)) > 0 THEN '✓ Should show checkmark' ELSE '✗ No checkmark' END as status
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check Brand Profile: business_brand_profile.brand_profile_v5 column
SELECT 
  'Brand Profile - brand_profile_v5' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✓ Should show checkmark' ELSE '✗ No checkmark' END as status
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND brand_profile_v5 IS NOT NULL;

-- Show actual menu results
SELECT 
  'Menu Details' as info,
  id,
  status,
  created_at
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 5;
