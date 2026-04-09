-- Single unified query to fetch ALL business data in one result
-- Returns a JSON object with all nested data

WITH opening_hours_data AS (
  SELECT 
    business_id,
    json_agg(
      json_build_object(
        'weekday', weekday,
        'open_time', open_time,
        'close_time', close_time,
        'closed', closed,
        'kind', kind
      ) ORDER BY 
        CASE weekday
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END
    ) as hours
  FROM opening_hours
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  GROUP BY business_id
),
menu_sources_data AS (
  SELECT
    business_id,
    json_agg(
      json_build_object(
        'id', id,
        'source_url', source_url,
        'source_type', source_type,
        'status', status,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ) as sources
  FROM menu_sources
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  GROUP BY business_id
),
menu_results_data AS (
  SELECT
    business_id,
    json_agg(
      json_build_object(
        'id', id,
        'source_url', source_url,
        'source_kind', source_kind,
        'raw_text_preview', LEFT(raw_text, 500),
        'structured_data', structured_data,
        'status', status,
        'extraction_method', extraction_method,
        'created_at', created_at,
        'completed_at', completed_at
      ) ORDER BY created_at DESC
    ) as results
  FROM menu_results_v2
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  GROUP BY business_id
)
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.website_url,
  
  -- Opening hours (from separate table)
  COALESCE(oh.hours, '[]'::json) as opening_hours,
  
  -- Operations data
  bo.service_periods,
  bo.establishment_type,
  bo.has_table_service,
  bo.has_takeaway,
  bo.has_delivery,
  bo.has_kids_menu,
  bo.has_outdoor_seating,
  bo.has_wifi,
  bo.has_power_outlets,
  bo.has_parking,
  bo.reservation_required,
  bo.accepts_walk_ins,
  bo.price_level,
  bo.average_check_per_person,
  bo.currency,
  bo.seating_capacity_indoor,
  bo.seating_capacity_outdoor,
  bo.typical_busy_periods,
  bo.typical_slow_periods,
  
  -- Menu sources (from separate table)
  COALESCE(ms.sources, '[]'::json) as menu_sources,
  
  -- Menu extraction results (from separate table)
  COALESCE(mr.results, '[]'::json) as menu_results,
  
  -- Profile data
  bp.menu_description,
  bp.menu_structure,
  bp.short_description,
  bp.long_description,
  bp.target_audience,
  bp.detected_menu_urls
  
FROM businesses b
LEFT JOIN business_operations bo ON b.id = bo.business_id
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN opening_hours_data oh ON b.id = oh.business_id
LEFT JOIN menu_sources_data ms ON b.id = ms.business_id
LEFT JOIN menu_results_data mr ON b.id = mr.business_id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';
