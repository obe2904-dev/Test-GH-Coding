-- ============================================================================
-- CHECK YOUR ACTUAL BUSINESS COMPLETION STATUS
-- ============================================================================
-- Find YOUR business (not Café Faust) and check what data exists
-- ============================================================================

-- 1. Find your business
SELECT 
  'Your Business' as info,
  id,
  name,
  website_url,
  owner_id
FROM businesses
WHERE owner_id IN (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 2. Check Profile completion (website_analyses with status='success')
WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Profile Check' as check_type,
  wa.id,
  wa.business_id,
  wa.status,
  wa.last_run_at,
  CASE WHEN wa.status = 'success' THEN '✓ SHOULD SHOW CHECKMARK' ELSE '✗ No checkmark (status not success)' END as result
FROM website_analyses wa
INNER JOIN my_business mb ON wa.business_id = mb.id
ORDER BY wa.last_run_at DESC
LIMIT 3;

-- 3. Check Menu completion (menu_results_v2 with status='done')
WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Menu Check' as check_type,
  mr.id,
  mr.business_id,
  mr.status,
  mr.completed_at,
  CASE WHEN mr.status = 'done' THEN '✓ SHOULD SHOW CHECKMARK' ELSE '✗ No checkmark (status=' || mr.status || ')' END as result
FROM menu_results_v2 mr
INNER JOIN my_business mb ON mr.business_id = mb.id
ORDER BY mr.completed_at DESC
LIMIT 3;

-- 4. Check Brand Profile completion
WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Brand Profile Check' as check_type,
  bbp.business_id,
  CASE 
    WHEN bbp.brand_profile_v5 IS NOT NULL THEN '✓ SHOULD SHOW CHECKMARK'
    ELSE '✗ No checkmark (brand_profile_v5 is NULL)'
  END as result,
  bbp.brand_profile_v5_generated_at
FROM business_brand_profile bbp
INNER JOIN my_business mb ON bbp.business_id = mb.id;

-- 5. Check Location completion
WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Location Check' as check_type,
  b.id,
  b.address,
  LENGTH(COALESCE(b.address, '')) as address_length,
  CASE 
    WHEN b.address IS NOT NULL AND LENGTH(TRIM(b.address)) > 0 THEN '✓ SHOULD SHOW CHECKMARK'
    ELSE '✗ No checkmark (address is empty/null)'
  END as result
FROM businesses b
INNER JOIN my_business mb ON b.id = mb.id;
