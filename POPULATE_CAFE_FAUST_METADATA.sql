-- =====================================================
-- BUG #5 FIX: POPULATE MENU METADATA FOR CAFÉ FAUST
-- =====================================================
-- Populates menu_item_metadata for all 73 menu items
-- Based on dish analysis for Danish café cuisine

-- Business: Café Faust (Aarhus, Denmark)
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af

DO $$
DECLARE
  v_business_id UUID := '840347de-9ba7-4275-8aa3-4553417fc2af';
  v_count INTEGER;
BEGIN
  -- Verify business exists
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = v_business_id) THEN
    RAISE EXCEPTION '❌ Business not found';
  END IF;

  -- Clear any existing metadata for this business
  DELETE FROM menu_item_metadata WHERE business_id = v_business_id;
  
  RAISE NOTICE '✅ Populating metadata for Café Faust menu items...';

  -- Insert metadata for all menu items
  -- Organized by category with intelligent defaults
  
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
  )
  SELECT 
    v_business_id as business_id,
    mr.name as item_name,
    mr.category as item_category,
    'all_day' as item_section,
    
    -- is_signature: Flag classic Danish café dishes
    CASE 
      WHEN mr.name ILIKE '%smørrebrød%' THEN TRUE
      WHEN mr.name ILIKE '%frikadeller%' THEN TRUE
      WHEN mr.name ILIKE '%stjerneskud%' THEN TRUE
      WHEN mr.name ILIKE '%pariserbøf%' THEN TRUE
      WHEN mr.name ILIKE '%flæskesteg%' THEN TRUE
      WHEN mr.name ILIKE '%wienerschnitzel%' THEN TRUE
      WHEN mr.name ILIKE '%sol over gudhjem%' THEN TRUE
      ELSE FALSE
    END as is_signature,
    
    -- is_seasonal: Identify seasonal items
    CASE
      -- Spring items (asparagus, new potatoes, lamb)
      WHEN mr.name ILIKE '%asparges%' OR mr.name ILIKE '%asparagus%' THEN TRUE
      WHEN mr.name ILIKE '%nye kartofler%' OR mr.name ILIKE '%new potato%' THEN TRUE
      WHEN mr.name ILIKE '%lam%' OR mr.name ILIKE '%lamb%' THEN TRUE
      
      -- Summer items (strawberry, tomato, fresh fish)
      WHEN mr.name ILIKE '%jordbær%' OR mr.name ILIKE '%strawberry%' THEN TRUE
      WHEN mr.name ILIKE '%tomat%' OR mr.name ILIKE '%tomato%' THEN TRUE
      
      -- Fall items (mushroom, squash, game)
      WHEN mr.name ILIKE '%svampe%' OR mr.name ILIKE '%mushroom%' THEN TRUE
      WHEN mr.name ILIKE '%græskar%' OR mr.name ILIKE '%squash%' THEN TRUE
      WHEN mr.name ILIKE '%vildtpat%' OR mr.name ILIKE '%game%' THEN TRUE
      
      -- Winter items (kale, root vegetables, hearty stews)
      WHEN mr.name ILIKE '%grønkål%' OR mr.name ILIKE '%kale%' THEN TRUE
      WHEN mr.name ILIKE '%gryde%' OR mr.name ILIKE '%stew%' THEN TRUE
      WHEN mr.name ILIKE '%rodfrugter%' OR mr.name ILIKE '%root vegetable%' THEN TRUE
      
      ELSE FALSE
    END as is_seasonal,
    
    FALSE as is_limited_time,
    
    -- dish_temp_category: Infer from dish type
    CASE
      -- Cold dishes
      WHEN mr.name ILIKE '%salat%' OR mr.name ILIKE '%salad%' THEN 'cold'
      WHEN mr.name ILIKE '%smørrebrød%' THEN 'cold'
      WHEN mr.name ILIKE '%carpaccio%' THEN 'cold'
      WHEN mr.name ILIKE '%tartare%' THEN 'cold'
      WHEN mr.name ILIKE '%røget%' AND mr.name ILIKE '%laks%' THEN 'cold'
      WHEN mr.name ILIKE '%is%' OR mr.name ILIKE '%ice cream%' THEN 'cold'
      WHEN mr.name ILIKE '%sorbet%' THEN 'cold'
      
      -- Hot dishes
      WHEN mr.name ILIKE '%gryde%' OR mr.name ILIKE '%stew%' THEN 'hot'
      WHEN mr.name ILIKE '%steg%' OR mr.name ILIKE '%roast%' THEN 'hot'
      WHEN mr.name ILIKE '%bøf%' OR mr.name ILIKE '%steak%' THEN 'hot'
      WHEN mr.name ILIKE '%frikadeller%' THEN 'hot'
      WHEN mr.name ILIKE '%schnitzel%' THEN 'hot'
      WHEN mr.name ILIKE '%grill%' THEN 'hot'
      WHEN mr.name ILIKE '%pasta%' THEN 'hot'
      WHEN mr.name ILIKE '%suppe%' OR mr.name ILIKE '%soup%' THEN 'hot'
      WHEN mr.name ILIKE '%risotto%' THEN 'hot'
      
      -- Warm dishes (can be served warm or room temp)
      WHEN mr.name ILIKE '%tærte%' OR mr.name ILIKE '%tart%' THEN 'warm'
      WHEN mr.name ILIKE '%quiche%' THEN 'warm'
      WHEN mr.name ILIKE '%pai%' OR mr.name ILIKE '%pie%' THEN 'warm'
      
      -- Default to neutral for beverages and unclear items
      ELSE 'neutral'
    END as dish_temp_category,
    
    -- Assume items added 6 months ago (can be updated later)
    NOW() - INTERVAL '180 days' as item_added_date,
    
    -- seasonal_ingredients: Extract key ingredients
    CASE
      WHEN mr.name ILIKE '%laks%' OR mr.name ILIKE '%salmon%' THEN '["salmon"]'::jsonb
      WHEN mr.name ILIKE '%bøf%' OR mr.name ILIKE '%beef%' THEN '["beef"]'::jsonb
      WHEN mr.name ILIKE '%kylling%' OR mr.name ILIKE '%chicken%' THEN '["chicken"]'::jsonb
      WHEN mr.name ILIKE '%svin%' OR mr.name ILIKE '%pork%' THEN '["pork"]'::jsonb
      WHEN mr.name ILIKE '%rejer%' OR mr.name ILIKE '%shrimp%' THEN '["shrimp"]'::jsonb
      WHEN mr.name ILIKE '%asparges%' OR mr.name ILIKE '%asparagus%' THEN '["asparagus"]'::jsonb
      WHEN mr.name ILIKE '%svampe%' OR mr.name ILIKE '%mushroom%' THEN '["mushrooms"]'::jsonb
      WHEN mr.name ILIKE '%tomat%' OR mr.name ILIKE '%tomato%' THEN '["tomatoes"]'::jsonb
      ELSE '[]'::jsonb
    END as seasonal_ingredients,
    
    -- location_tags: Add photogenic/local specialty tags
    CASE
      WHEN mr.name ILIKE '%smørrebrød%' THEN ARRAY['danish_classic', 'photogenic', 'local_specialty']
      WHEN mr.name ILIKE '%frikadeller%' THEN ARRAY['danish_classic', 'comfort_food']
      WHEN mr.name ILIKE '%stjerneskud%' THEN ARRAY['photogenic', 'signature', 'seafood']
      WHEN mr.name ILIKE '%pariserbøf%' THEN ARRAY['classic', 'comfort_food']
      WHEN mr.category = 'Drinks' THEN ARRAY['beverage']
      WHEN mr.category ILIKE '%dessert%' THEN ARRAY['photogenic', 'sweet']
      ELSE ARRAY['standard']
    END as location_tags,
    
    -- Assume no previous posts (can be updated with real data)
    0 as total_times_posted,
    0 as avg_engagement_rate,
    NULL as last_posted_date
    
  FROM menu_results_v2 mr
  WHERE mr.business_id = v_business_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '✅ Inserted % menu item metadata records', v_count;

  -- Verify insertion
  SELECT COUNT(*) INTO v_count
  FROM menu_item_metadata
  WHERE business_id = v_business_id;
  
  RAISE NOTICE '✅ Total metadata records in database: %', v_count;
  
  -- Show sample results
  RAISE NOTICE '📊 Sample metadata (first 5 items):';
  RAISE NOTICE '─────────────────────────────────────────────────────────';
  
END $$;

-- Query to verify results
SELECT 
  item_name,
  is_signature,
  is_seasonal,
  dish_temp_category,
  seasonal_ingredients,
  location_tags
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY 
  is_signature DESC,
  is_seasonal DESC,
  item_name
LIMIT 20;
