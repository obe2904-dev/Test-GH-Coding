-- ========================================
-- LAYER 5: OPPORTUNITY SELECTOR (MENU SCORING) VERIFICATION
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- ========================================

-- Layer 5 scores menu items to select which dishes deserve posts
-- Previous logs showed: "Top 3: FAVORITTEN (70), Pandekage (70), DEN NYE (70)"

-- Q1: Check if there's a menu scoring/metadata table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%menu%' OR table_name LIKE '%item%' OR table_name LIKE '%score%')
ORDER BY table_name;

-- Q2: Check menu_item_metadata structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_item_metadata'
ORDER BY ordinal_position;

-- Q3: Check if Café Faust menu items have metadata/scores
SELECT 
  item_name,
  item_category,
  last_posted_date,
  total_times_posted,
  avg_engagement_rate,
  is_signature,
  is_seasonal
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY total_times_posted DESC NULLS LAST
LIMIT 10;

-- Q4: Count how many Café Faust items have metadata
SELECT 
  COUNT(*) as items_with_metadata,
  COUNT(*) FILTER (WHERE is_signature = true) as signature_items,
  COUNT(*) FILTER (WHERE is_seasonal = true) as seasonal_items,
  COUNT(*) FILTER (WHERE total_times_posted > 0) as previously_posted
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Q5: Check seasonal_ingredients table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'seasonal_ingredients'
ORDER BY ordinal_position;

-- Q6: Check if seasonal_ingredients has Danish winter data
SELECT 
  ingredient_name,
  season,
  peak_months,
  bonus_points
FROM seasonal_ingredients
WHERE country_code = 'DK'
  AND season = 'winter'
LIMIT 20;

-- ========================================
-- LAYER 5 VERIFICATION RESULTS
-- ========================================
-- 
-- ⚠️ LAYER 5 CRITICAL BUG FOUND
--
-- FINDINGS:
-- 1. MISMATCH: Real menu vs Metadata
--    - menu_results_v2: 73 REAL Café Faust items (FAVORITTEN, PARISERBØF, etc.)
--    - menu_item_metadata: 7 TEST items (Caesar Salad, Strawberry Ice Cream, etc.)
--    - NO OVERLAP: Real menu items have zero metadata
--
-- 2. SCORING BUG (menu-scorer.ts line 159):
--    - Code reads from menu_results_v2 (correct - gets real 73 items)
--    - Creates MenuItemScore with finalScore: 70 (hardcoded default)
--    - NEVER calls scoreMenuItem() function which has real scoring logic
--    - Result: Everything gets 70 points regardless of season/signature/weather
--
-- 3. WHY EVERYTHING SCORES 70:
--    - scoreMenuItems() loops through items
--    - Creates score object with "finalScore: 70" directly
--    - Real scoring function (scoreMenuItem) exists but is never invoked
--    - scoreMenuItem() would calculate: baseScore + seasonal + weather + location + performance
--
-- 4. METADATA INFRASTRUCTURE EXISTS:
--    - menu_item_metadata table: 21 columns for tracking
--    - Fields: is_signature, is_seasonal, dish_temp_category, seasonal_ingredients
--    - seasonal_ingredients table: Has Danish winter data
--    - But Café Faust's real menu items not in metadata table
--
-- 5. EXPECTED SCORING LOGIC (not currently used):
--    - baseScore: 50 (regular), 75 (seasonal), 85 (limited), 100 (signature)
--    - + seasonalBonus: 0-50 based on winter ingredients
--    - + weatherBonus: hot/cold dish alignment
--    - + locationBonus: waterfront/tourist area tags
--    - + performanceBonus: historical engagement
--    - - recencyPenalty: -100 if posted < 7 days ago
--    - finalScore determines: blocked (<50), low (50-99), medium (100-149), high (150-199), critical (200+)
--
-- RESULT: Layer 5 code exists but simplified scoring used
-- All items get 70 points, no differentiation based on season/signature/weather
-- ========================================
