-- Quick verification: Check if dropped tables still exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'business_classes',
      'business_products', 
      'business_services',
      'offerings',
      'post_drafts',
      'specials',
      'business_menu_metadata',
      'business_goals',
      'business_audience_profile',
      'business_visual_identity'
    ) THEN '❌ SHOULD BE GONE'
    ELSE '✅ OK to exist'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'business_classes',
    'business_products', 
    'business_services',
    'offerings',
    'post_drafts',
    'specials',
    'business_menu_metadata',
    'business_goals',
    'business_audience_profile',
    'business_visual_identity'
  )
ORDER BY table_name;

-- If this returns 0 rows, cleanup was successful ✅
