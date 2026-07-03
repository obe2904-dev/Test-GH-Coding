-- Quick check: Are scores still all 70 or varied?
SELECT 
    (p->'opportunity'->>'finalScore')::int as score,
    COUNT(*) as count
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (SELECT MAX(created_at) FROM weekly_content_plans WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
GROUP BY (p->'opportunity'->>'finalScore')::int
ORDER BY score DESC;
