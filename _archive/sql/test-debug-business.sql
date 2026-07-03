-- Verify the business and menu data exist
SELECT 'businesses' as table_name, COUNT(*) as count FROM businesses
UNION ALL
SELECT 'menu_item_metadata', COUNT(*) FROM menu_item_metadata;

-- Show the actual business ID we have
SELECT id, created_at FROM businesses LIMIT 1;

-- Show menu items and their business ID
SELECT business_id, COUNT(*) as item_count 
FROM menu_item_metadata 
GROUP BY business_id;
