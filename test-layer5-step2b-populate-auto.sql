-- =====================================================
-- LAYER 5 TEST - STEP 2: POPULATE TEST DATA (AUTO)
-- =====================================================
-- Automatically uses first available business - no manual ID needed

DO $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Automatically get first business
  SELECT id INTO v_business_id
  FROM businesses
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION '❌ No businesses found in database. Create a business first.';
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
    NOW() - INTERVAL '120 days',
    '["salmon", "asparagus"]'::jsonb,
    ARRAY['seafood', 'photogenic'],
    8,
    6.5,
    NOW() - INTERVAL '25 days'
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
    0,
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
    4.2,
    NOW() - INTERVAL '15 days'
  ),
  
  -- Seasonal special: Strawberry Ice Cream (summer item - wrong season)
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
    8.2,
    NOW() - INTERVAL '150 days'
  ),
  
  -- Recently posted: Burger (should be BLOCKED)
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
    NOW() - INTERVAL '3 days' -- BLOCKED
  ),
  
  -- High performer: Mushroom Risotto
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
    9.5,
    NOW() - INTERVAL '45 days'
  ),
  
  -- Limited time offer: Winter Stew
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

-- Verify data
SELECT 
  item_name,
  is_signature AS sig,
  is_seasonal AS seas,
  is_limited_time AS lto,
  dish_temp_category AS temp,
  ROUND(DATE_PART('day', NOW() - item_added_date)) as days_old,
  ROUND(DATE_PART('day', NOW() - last_posted_date)) as days_since_post,
  total_times_posted AS times,
  avg_engagement_rate AS eng_rate
FROM menu_item_metadata
ORDER BY is_signature DESC, is_seasonal DESC, item_added_date DESC;
