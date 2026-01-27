-- Fetch opening hours, service periods, menu description, and full menu structure
-- Replace 'YOUR_BUSINESS_ID' with actual business ID

-- 1. Get opening hours
SELECT 
  'opening_hours' as data_type,
  business_id,
  weekday,
  open_time,
  close_time,
  closed,
  kind
FROM opening_hours
WHERE business_id = 'YOUR_BUSINESS_ID'
ORDER BY 
  CASE weekday
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END;

-- 2. Get service periods (from business_operations JSONB)
SELECT 
  'service_periods' as data_type,
  business_id,
  service_periods
FROM business_operations
WHERE business_id = 'YOUR_BUSINESS_ID';

-- 3. Get menu sources (URLs)
SELECT 
  'menu_sources' as data_type,
  id,
  business_id,
  source_url,
  source_type,
  status,
  created_at
FROM menu_sources
WHERE business_id = 'YOUR_BUSINESS_ID'
ORDER BY created_at DESC;

-- 4. Get extracted menu data
SELECT 
  'menu_results' as data_type,
  mr.id,
  mr.business_id,
  mr.source_url,
  mr.source_kind,
  mr.raw_text,
  mr.structured_data,
  mr.status,
  mr.error_message,
  mr.extraction_method,
  mr.created_at,
  mr.completed_at
FROM menu_results_v2 mr
WHERE mr.business_id = 'YOUR_BUSINESS_ID'
ORDER BY mr.created_at DESC;

-- 5. Get business profile with menu description
SELECT 
  'business_profile' as data_type,
  business_id,
  menu_description,
  menu_structure,
  short_description,
  long_description,
  target_audience
FROM business_profile
WHERE business_id = 'YOUR_BUSINESS_ID';

-- 6. Get operations data
SELECT 
  'operations' as data_type,
  business_id,
  establishment_type,
  has_table_service,
  has_takeaway,
  has_delivery,
  has_kids_menu,
  has_outdoor_seating,
  reservation_required,
  accepts_walk_ins,
  price_level,
  average_check_per_person,
  currency,
  typical_busy_periods,
  typical_slow_periods
FROM business_operations
WHERE business_id = 'YOUR_BUSINESS_ID';
