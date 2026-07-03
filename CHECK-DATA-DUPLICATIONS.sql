-- ============================================================================
-- CHECK FOR DATA DUPLICATIONS ACROSS TABLES
-- ============================================================================
-- Identifies fields that exist in multiple places (anti-pattern)
-- ============================================================================

-- Check if businesses table has location-related fields
SELECT 
  'BUSINESSES TABLE LOCATION FIELDS' as audit_section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
  AND column_name IN ('city', 'postal_code', 'address', 'address_line1', 'phone', 'email', 'country')
ORDER BY column_name;

-- Check business_locations table structure
SELECT 
  'BUSINESS_LOCATIONS TABLE' as audit_section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_locations'
ORDER BY ordinal_position;

-- Check actual location data (Cafe Faust example)
SELECT 
  'LOCATION DATA - Cafe Faust' as check_type,
  b.name as business_name,
  b.local_location_reference,
  bl.city as city_from_business_locations,
  bl.postal_code as postal_code_from_business_locations,
  bl.is_primary,
  CASE 
    WHEN bl.city IS NOT NULL AND bl.postal_code IS NOT NULL 
    THEN '✅ COMPLETE'
    WHEN bl.city IS NULL OR bl.postal_code IS NULL 
    THEN '⚠️  INCOMPLETE'
    ELSE '❌ NO LOCATION'
  END as status
FROM businesses b
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
