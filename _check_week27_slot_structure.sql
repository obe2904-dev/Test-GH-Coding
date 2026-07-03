-- Check Week 27 strategy to validate new slot architecture
SELECT 
  ws.week_number,
  ws.created_at,
  jsonb_array_length(ws.strategic_brief -> 'angles') as angle_count,
  jsonb_pretty(
    jsonb_build_object(
      'week_summary', ws.strategic_brief ->> 'week_summary',
      'slots', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'slot_id', a ->> 'slot_id',
            'focus', LEFT(a ->> 'focus', 60),
            'strategic_intent', LEFT(a ->> 'strategic_intent', 60),
            'weight', a -> 'weight',
            'goal_mode', a ->> 'goal_mode',
            'target_days', a -> 'target_days',
            'target_service_period', a ->> 'target_service_period'
          ) ORDER BY (a ->> 'slot_id')::text
        )
        FROM jsonb_array_elements(ws.strategic_brief -> 'angles') AS a
      )
    )
  ) as slot_structure
FROM weekly_strategies ws
WHERE ws.business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND ws.week_number = 27
ORDER BY ws.created_at DESC
LIMIT 1;
