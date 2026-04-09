-- ============================================================================
-- WHAT DATA EXISTS FOR CAFÉ FAUST RIGHT NOW?
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af
-- ============================================================================

-- Query 1: See EVERYTHING in business_brand_profile
-- ============================================================================
SELECT 
  business_id,
  tone_keywords,
  voice_style,
  business_voice,  -- New column we just discovered!
  values,
  certifications,
  do_not_say,
  offerings_full,
  booking_link,
  cta_preference
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 2: Show me the businesses table data
-- ============================================================================
SELECT 
  id,
  name,
  category,
  country,
  selected_platforms
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 3: Show me business_locations data
-- ============================================================================
SELECT 
  business_id,
  city,
  country,
  is_primary
FROM business_locations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- ============================================================================
-- EXPECTED RESULTS BASED ON SCREENSHOT:
-- ============================================================================
-- From Content Style page, user selected "Friendly & Approachable":
-- - Should see: voice_style or business_voice = "Friendly & Approachable" 
--               or something similar
-- - tone_keywords might have: ["warm", "inviting", "conversational"] or Danish equivalents
-- - Emoji style: "2-3 strategic"
--
-- Let's see what's actually there!
-- ============================================================================
