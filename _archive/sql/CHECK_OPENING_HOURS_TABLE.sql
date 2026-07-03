-- Check if opening_hours table exists and has any data
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'opening_hours';

-- If it exists, check its structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'opening_hours'
ORDER BY ordinal_position;

-- Check if there's any opening hours data
SELECT * FROM opening_hours LIMIT 5;
