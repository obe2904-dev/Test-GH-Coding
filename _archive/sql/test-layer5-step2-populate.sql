-- =====================================================
-- LAYER 5 TEST - STEP 2: POPULATE TEST DATA
-- =====================================================
-- Creates sample menu data for testing scoring algorithm

-- First, get a test business ID (replace with your actual business ID)
-- Run this to find a business:
-- SELECT id, business_name FROM businesses LIMIT 5;

-- For this test, we'll use a placeholder - REPLACE THIS WITH REAL ID
DO $$
DECLARE
  v_business_id UUID := 'YOUR_BUSINESS_ID_HERE'; -- ⚠️ REPLACE THIS
BEGIN
  -- Check if business exists
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = v_business_id) THEN
    RAISE NOTICE '❌ Business ID not found. Update v_business_id with real business ID from: SELECT id, business_name FROM businesses LIMIT 5;';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Using business ID: %', v_business_id;

  -- Insert test menu items
  INSERT INTO menu_item_metadata (
    business_id,
    item_name,
    item_category,
    item_section,
    is_signature,
    is_seasonal,
    is_limited_time,
    dish_temp_category,
    item_added_date,
    seasonal_ingredients,
    location_tags,
    total_times_posted,
    avg_engagement_rate,
    last_posted_date
  ) VALUES 
  -- Signature dish: Grilled Salmon (should score HIGH)
  (
    v_business_id,
    'Grilled Salmon with Asparagus',
    'Main Course',
    'all_day',
    TRUE, -- signature
    TRUE, -- seasonal (spring)
    FALSE,
    'hot',
    NOW() - INTERVAL '120 days', -- Added 4 months ago
    '["salmon", "asparagus"]'::jsonb,
    ARRAY['seafood', 'photogenic'],
    8, -- Posted 8 times
    6.5, -- 6.5% engagement (above average)
    NOW() - INTERVAL '25 days' -- Last posted 25 days ago (no penalty)
  ),
  
  -- New menu item: Spring Lamb (should score HIGH - newness bonus)
  (
    v_business_id,
    'Spring Lamb with New Potatoes',
    'Main Course',
    'dinner',
    FALSE,
    TRUE, -- seasonal
    FALSE,
    'hot',
    NOW() - INTERVAL '5 days', -- Brand new!
    '["lamb", "new potatoes", "peas"]'::jsonb,
    ARRAY['local_specialty'],
    0, -- Never posted
    0,
    NULL
  ),
  
  -- Regular item: Caesar Salad (should score MODERATE)
  (
    v_business_id,
    'Caesar Salad',
    'Appetizer',
    'all_day',
    FALSE,
    FALSE,
    FALSE,
    'cold',
    NOW() - INTERVAL '180 days',
    '["lettuce", "tomatoes"]'::jsonb,
    ARRAY['quick_lunch'],
    12,
    4.2, -- Below average engagement
    NOW() - INTERVAL '15 days' -- Slight recency penalty
  ),
  
  -- Seasonal special: Strawberry Ice Cream (summer item - wrong season now)
  (
    v_business_id,
    'Strawberry Ice Cream',
    'Dessert',
    'all_day',
    FALSE,
    TRUE,
    FALSE,
    'cold',
    NOW() - INTERVAL '240 days',
    '["strawberries", "ice cream"]'::jsonb,
    ARRAY['photogenic'],
    15,
    8.2, -- High engagement when in season
    NOW() - INTERVAL '150 days' -- Not posted recently (winter)
  ),
  
  -- Recently posted item: Burger (should be BLOCKED)
  (
    v_business_id,
    'Classic Burger',
    'Main Course',
    'all_day',
    FALSE,
    FALSE,
    FALSE,
    'hot',
    NOW() - INTERVAL '90 days',
    '[]'::jsonb,
    ARRAY['comfort_food'],
    5,
    5.0,
    NOW() - INTERVAL '3 days' -- Posted 3 days ago (BLOCKED)
  ),
  
  -- High performer: Mushroom Risotto (autumn dish)
  (
    v_business_id,
    'Wild Mushroom Risotto',
    'Main Course',
    'dinner',
    FALSE,
    TRUE,
    FALSE,
    'warm',
    NOW() - INTERVAL '200 days',
    '["mushrooms"]'::jsonb,
    ARRAY['photogenic', 'comfort_food'],
    10,
    9.5, -- Excellent engagement!
    NOW() - INTERVAL '45 days'
  ),
  
  -- Limited time offer: Winter Stew (wrong season but LTO)
  (
    v_business_id,
    'Danish Winter Stew',
    'Main Course',
    'dinner',
    FALSE,
    FALSE,
    TRUE, -- LTO
    'hot',
    NOW() - INTERVAL '60 days',
    '["stew", "root vegetables", "kale"]'::jsonb,
    ARRAY['comfort_food', 'local_specialty'],
    3,
    6.8,
    NOW() - INTERVAL '55 days'
  )
  ON CONFLICT (business_id, item_name) 
  DO UPDATE SET
    item_category = EXCLUDED.item_category,
    is_signature = EXCLUDED.is_signature,
    is_seasonal = EXCLUDED.is_seasonal,
    seasonal_ingredients = EXCLUDED.seasonal_ingredients;

  RAISE NOTICE '✅ Inserted 7 test menu items';
  
END $$;

-- Verify data inserted
SELECT 
  item_name,
  is_signature,
  is_seasonal,
  is_limited_time,
  dish_temp_category,
  DATE_PART('day', NOW() - item_added_date) as days_old,
  DATE_PART('day', NOW() - last_posted_date) as days_since_posted,
  total_times_posted,
  avg_engagement_rate
FROM menu_item_metadata
ORDER BY is_signature DESC, is_seasonal DESC, item_added_date DESC;
