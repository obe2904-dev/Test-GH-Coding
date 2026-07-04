-- Check current constraint on media_library.post_type
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'media_library'::regclass
  AND conname LIKE '%post_type%';

-- Show current post_type values in use
SELECT 
  post_type,
  COUNT(*) as count
FROM media_library
GROUP BY post_type
ORDER BY count DESC;
