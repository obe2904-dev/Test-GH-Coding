-- Check if user has a business record
SELECT 
  b.id,
  b.user_id,
  b.business_name,
  b.business_type,
  b.selected_platforms,
  b.created_at
FROM businesses b
WHERE b.user_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';
