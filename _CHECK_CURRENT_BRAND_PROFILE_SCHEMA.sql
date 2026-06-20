-- ============================================================================
-- CHECK: Current business_brand_profile schema
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;
