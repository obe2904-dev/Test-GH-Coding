-- Check if businesses.about field exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_name LIKE '%about%'
  OR column_name LIKE '%description%'
  OR column_name LIKE '%character%';

-- Check Cafe Faust's about field
SELECT id, name, about FROM businesses WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
