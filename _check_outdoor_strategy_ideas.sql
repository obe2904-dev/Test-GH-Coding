-- Check recent weekly strategy ideas for the business
SELECT 
  ws.id as strategy_id,
  ws.week_start,
  ws.week_number,
  ws.created_at,
  jsonb_pretty(ws.week_context_snapshot -> 'weather') as weather_data,
  jsonb_pretty(ws.week_context_snapshot -> 'location') as location_data,
  ws.status,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'title', idea.title,
        'rationale', idea.rationale,
        'content_category', idea.content_category
      ) ORDER BY idea.slot_index
    )
    FROM jsonb_to_recordset(ws.ideas) AS idea(
      title text,
      rationale text,
      content_category text,
      slot_index int
    )
  ) as ideas_summary
FROM weekly_strategies ws
WHERE ws.business_id = '69fabd28-83cd-4b60-859e-b1f80c387df9'
ORDER BY ws.created_at DESC
LIMIT 3;
