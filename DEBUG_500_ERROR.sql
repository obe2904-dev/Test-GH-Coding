-- Test different column selections to isolate the issue

-- Test 1: Select just ID (should work)
SELECT id FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 2: Select id and name (should work)
SELECT id, name FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 3: Select plan specifically (this is what's failing in the app)
SELECT plan FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 4: Check if there's a function or trigger on businesses table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'businesses';

-- Test 5: Check for any computed columns or generated columns
SELECT 
  column_name,
  data_type,
  column_default,
  is_generated
FROM information_schema.columns
WHERE table_name = 'businesses'
ORDER BY ordinal_position;
