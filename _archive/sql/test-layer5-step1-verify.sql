-- =====================================================
-- LAYER 5 TEST - STEP 1: VERIFY MIGRATION
-- =====================================================
-- Run this in Supabase Dashboard SQL Editor to verify migration success

-- Check if all tables exist
SELECT 
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ All 3 tables created'
    ELSE '❌ Missing tables - expected 3, found ' || COUNT(*)
  END as table_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('menu_item_metadata', 'seasonal_ingredients', 'opportunity_tracking');

-- Check seasonal ingredients populated
SELECT 
  CASE 
    WHEN COUNT(*) >= 45 THEN '✅ Seasonal ingredients populated (' || COUNT(*) || ' entries)'
    ELSE '❌ Seasonal ingredients missing - expected ~50, found ' || COUNT(*)
  END as ingredients_status
FROM seasonal_ingredients;

-- Check helper functions exist
SELECT 
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ Both helper functions created'
    ELSE '❌ Missing functions - expected 2, found ' || COUNT(*)
  END as functions_status
FROM pg_proc 
WHERE proname IN ('update_menu_item_posted', 'track_opportunity_trigger');

-- Sample seasonal ingredients by season
SELECT 
  season,
  COUNT(*) as ingredient_count,
  ARRAY_AGG(ingredient_name ORDER BY bonus_points DESC) FILTER (WHERE rn <= 3) as top_3_ingredients
FROM (
  SELECT 
    season,
    ingredient_name,
    bonus_points,
    ROW_NUMBER() OVER (PARTITION BY season ORDER BY bonus_points DESC) as rn
  FROM seasonal_ingredients
  WHERE country_code = 'DK'
) sub
WHERE rn <= 3
GROUP BY season
ORDER BY 
  CASE season 
    WHEN 'spring' THEN 1 
    WHEN 'summer' THEN 2 
    WHEN 'autumn' THEN 3 
    WHEN 'winter' THEN 4 
  END;
