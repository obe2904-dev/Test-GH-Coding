-- =====================================================
-- DIAGNOSE BUSINESS PROFILE ISSUE
-- =====================================================
-- Run these queries to understand why business profile is not loading

-- 1. Check if businesses table exists and has data
SELECT COUNT(*) as total_businesses, 
       COUNT(DISTINCT owner_id) as unique_owners
FROM businesses;

-- 2. Check for the specific user (from error logs)
SELECT id, name, owner_id, vertical, created_at
FROM businesses
WHERE owner_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1'
LIMIT 5;

-- 3. Check if the business_id from error exists
SELECT b.id, b.name, b.owner_id, b.vertical
FROM businesses b
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- 4. Check related tables
SELECT 
  b.id as business_id,
  b.name,
  b.owner_id,
  bp.short_description as has_profile,
  bbp.tone_keywords as has_brand_profile,
  bl.city as has_location
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id  
LEFT JOIN business_locations bl ON bl.business_id = b.id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- 5. Check RLS policies on businesses table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'businesses';

-- 6. Check if profiles table has business_offerings column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'business_offerings';

-- 7. Check if business_profile table has the columns frontend is trying to query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'business_profile'
  AND column_name IN ('menu_structure', 'booking_url');
