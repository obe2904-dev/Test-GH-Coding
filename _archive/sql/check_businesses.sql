-- Get available businesses in database
SELECT 
  id,
  name,
  category,
  city,
  country
FROM businesses
LIMIT 10;
