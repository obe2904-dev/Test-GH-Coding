-- =====================================================
-- GET BUSINESS ID FOR TESTING
-- =====================================================
-- Run this first to find your business ID

SELECT 
  id,
  business_name,
  country_code,
  outdoor_seating,
  CASE 
    WHEN avg_engagement_rate IS NOT NULL THEN ROUND(avg_engagement_rate * 100, 1) || '%'
    ELSE 'No data'
  END as avg_engagement
FROM businesses
ORDER BY created_at DESC
LIMIT 10;

-- Copy the 'id' value from one of these businesses
-- Then use it in the next step
