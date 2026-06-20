-- RUN THIS IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- Shows complete V5 data flow for Café Faust

-- ═══════════════════════════════════════════════════════════════════
-- 📥 INPUT DATA - What V5 Generator Had Access To
-- ═══════════════════════════════════════════════════════════════════

-- Business Information
SELECT 
  'Business Info' as section,
  b.name,
  bp.short_description,
  bp.long_description,
  bp.menu_description,
  b.created_at
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
WHERE b.id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Opening Hours
SELECT 
  'Opening Hours' as section,
  weekday,
  kind,
  open_time,
  close_time,
  closed
FROM opening_hours
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY CASE weekday
  WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
  WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
  WHEN 'sunday' THEN 7 END;

-- Location Information  
SELECT 
  'Location Info' as section,
  address_line1,
  city,
  postal_code,
  country,
  phone,
  email,
  maps_url,
  created_at
FROM business_locations
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Location Intelligence (neighborhood, category scores, etc)
SELECT 
  'Location Intelligence' as section,
  neighborhood,
  area_type,
  location_marketing_hooks::text,
  when_analysis::text,
  who_analysis::text,
  why_analysis::text,
  created_at
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Menu Items (sample)
SELECT 
  'Menu Items (sample 10)' as section,
  item_name,
  category_name,
  category_type,
  item_price,
  item_description,
  is_signature,
  is_seasonal,
  service_periods::text
FROM menu_items_normalized
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY category_name, item_name
LIMIT 10;

-- ═══════════════════════════════════════════════════════════════════
-- 🔍 LAYER 1 OUTPUT - Programme Detection
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  'Layer 1: Programmes' as layer,
  programme_type,
  programme_name,
  time_windows::text,
  menu_evidence::text,
  confidence,
  created_at
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ═══════════════════════════════════════════════════════════════════
-- 💼 LAYER 2 OUTPUT - Commercial Orientation (per programme)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  'Layer 2: Commercial Strategy' as layer,
  programme_name,
  baseline_goal_split::text,
  decision_timing,
  content_type_affinity::text
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ═══════════════════════════════════════════════════════════════════
-- 🎯 LAYER 3 OUTPUT - Identity Profile (business-level)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  'Layer 3: Identity' as layer,
  brand_essence,
  positioning,
  -- NOTE: The following columns don't exist yet - run APPLY_LAYER3_MIGRATION.sql first:
  -- core_values, what_makes_us_different, identity_confidence, identity_reasoning
  created_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ═══════════════════════════════════════════════════════════════════
-- 👥 LAYER 4 OUTPUT - Audience Segments (per programme)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  'Layer 4: Audiences' as layer,
  programme_name,
  audience_segments::text
FROM business_programme_profiles
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
