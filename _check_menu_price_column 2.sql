-- Check menu_items_normalized schema for price column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'menu_items_normalized'
  AND column_name LIKE '%price%'
ORDER BY ordinal_position;

-- Sample menu items to see price data
SELECT 
  name,
  price_dkk,
  service_periods,
  category
FROM menu_items_normalized
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price_dkk IS NOT NULL
ORDER BY service_periods, price_dkk
LIMIT 10;
