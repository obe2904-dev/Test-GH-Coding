-- Show the raw HTML that was extracted
SELECT 
  source_url,
  LENGTH(raw_html) as html_length,
  SUBSTRING(raw_html, 1, 2000) as html_preview
FROM menu_results_v2
WHERE source_url LIKE '%k-bbq.dk/menu%'
ORDER BY created_at DESC
LIMIT 1;
