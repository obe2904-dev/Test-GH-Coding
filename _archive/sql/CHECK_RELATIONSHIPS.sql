-- Check foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name = 'business_profile' 
       OR tc.table_name = 'business_brand_profile'
       OR tc.table_name = 'business_locations');

-- Test the actual join query that Edge Function uses
SELECT 
  b.id,
  b.name,
  bp.short_description,
  bbp.tone_keywords,
  bbp.voice_style,
  bl.city
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
LEFT JOIN business_locations bl ON bl.business_id = b.id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';
