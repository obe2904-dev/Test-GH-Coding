-- ========================================
-- LAYER 3: CONTEXTUAL CALENDAR VERIFICATION
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- Date: January 30, 2026 (Week 5, Winter)
-- ========================================

-- Layer 3 should generate compound opportunities based on:
-- 1. Season (vinter = winter in Denmark)
-- 2. Weather patterns
-- 3. Calendar events (holidays, local events)
-- 4. Cultural moments

-- Previous logs showed: "Compound opportunities: 1" (need 4!)

-- Q1: Check if there's a calendar/events table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%calendar%' OR table_name LIKE '%event%' OR table_name LIKE '%holiday%')
ORDER BY table_name;

-- Q2: Check if there's a seasonal content table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%season%' OR table_name LIKE '%context%' OR table_name LIKE '%opportunity%')
ORDER BY table_name;

-- Q3: Look for any Denmark-specific calendar data
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (column_name LIKE '%country%' OR column_name LIKE '%denmark%' OR column_name LIKE '%DK%')
ORDER BY table_name, column_name;

-- Q4: Check if compound opportunities are stored in database
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name LIKE '%compound%'
ORDER BY table_name, column_name;

-- Q5: Check what columns businesses table actually has
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name IN ('outdoor_seating', 'area_type', 'service_periods', 'primary_service_period', 'category_scores')
ORDER BY column_name;

-- Q6: Check what columns business_locations actually has
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'business_locations'
ORDER BY ordinal_position;

-- Q7: Check contextual_calendar table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contextual_calendar'
ORDER BY ordinal_position;

-- Q8: Check calendar events for Denmark (country-based, not business-specific!)
SELECT 
  date_start,
  date_end,
  event_type,
  event_name,
  region,
  relevance_tags,
  content_angle
FROM contextual_calendar
WHERE country = 'DK'
  AND date_start >= CURRENT_DATE
  AND date_start <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY date_start
LIMIT 10;

-- Q9: Check ALL Denmark events for 2026 (full year)
SELECT 
  date_start,
  date_end,
  event_type,
  event_name,
  recurrence
FROM contextual_calendar
WHERE country = 'DK'
  AND EXTRACT(YEAR FROM date_start) = 2026
ORDER BY date_start;

-- ========================================
-- Layer 3 is likely TypeScript-based, not database-driven
-- Will need to check opportunity-generator.ts or similar
-- ========================================

-- ========================================
-- LAYER 3 VERIFICATION RESULTS
-- ========================================
-- 
-- ✅ LAYER 3 ISSUES FOUND AND FIXED
--
-- FINDINGS:
-- 1. contextual_calendar table EXISTS with 3 Denmark events:
--    - Vinterferie (Feb 7-15): families, cozy_indoor
--    - Valentinsdag (Feb 14): couples, romantic
--    - Fastelavn (Feb 15): families, kids tradition
--
-- 2. SCHEMA MISMATCH BUGS (NOW FIXED):
--    ❌ Code queried business_id (doesn't exist) → ✅ Changed to country
--    ❌ Code queried event_date, event_category → ✅ Changed to date_start, relevance_tags
--    ❌ Code filtered 7-14 days out (too narrow) → ✅ Changed to next 30 days
--    ❌ Code expected location context columns → ⚠️ Still missing (outdoor_seating, area_type, category_scores)
--
-- 3. MISSING SCHEMA:
--    - businesses table has NO location context fields
--    - Cannot detect: waterfront, tourist_area, business_district, outdoor_seating
--    - Most compound opportunity patterns are DISABLED
--
-- 4. RESULT AFTER FIX:
--    - Calendar events should now generate 3 compound opportunities (was 0)
--    - Location-based patterns still broken (need schema migration)
--    - Total: 3 menu + 3 calendar = 6/7 slots (improvement!)
--
-- NEXT: Deploy and test if calendar events now generate opportunities
-- ========================================
