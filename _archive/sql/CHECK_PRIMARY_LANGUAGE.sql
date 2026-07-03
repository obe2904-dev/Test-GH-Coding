-- Check the business's primary_language setting
SELECT 
  id,
  name,
  primary_language,
  owner_id
FROM businesses 
WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';
