-- Run these queries one by one to find which fails

-- Test 1: Just ID
SELECT id FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 2: ID and name
SELECT id, name FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 3: Just plan (this is what the app requests)
SELECT plan FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- Test 4: All columns (this is what fails with select=*)
SELECT * FROM businesses WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';
