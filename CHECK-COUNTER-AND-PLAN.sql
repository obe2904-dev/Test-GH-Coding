-- =====================================================
-- CHECK COUNTER AND PLAN STATUS - 17. maj 2026
-- =====================================================
-- Check current counter status and plan for Cafe Faust

SELECT 
  id,
  name,
  plan,
  quick_suggestions_today AS "Counter Value",
  last_quick_suggestions_reset AS "Last Reset Date",
  brand_tone,
  CURRENT_DATE AS "Today's Date",
  CASE 
    WHEN plan = 'free' THEN 1
    WHEN plan = 'standardplus' THEN 3
    WHEN plan = 'premium' THEN 5
    ELSE 1
  END AS "Daily Limit"
FROM businesses 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Also check if business_operations exists
SELECT 
  business_id,
  has_outdoor_seating,
  has_kids_menu,
  has_takeaway,
  has_table_service
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
