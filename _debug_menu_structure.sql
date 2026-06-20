-- Debug: Check actual menu data structure for Café Faust
-- This will help us see why item_count and avg_price are 0

SELECT 
  service_period_name,
  service_periods,
  ai_summary,
  structured_data->>'items' as items_check,
  jsonb_array_length(
    CASE 
      WHEN jsonb_typeof(structured_data->'items') = 'array' THEN structured_data->'items'
      ELSE '[]'::jsonb 
    END
  ) as item_count,
  structured_data
FROM menu_results_v2 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' 
  AND status = 'done'
ORDER BY created_at DESC
LIMIT 3;
