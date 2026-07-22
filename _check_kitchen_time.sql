-- Check kitchen_close_time for Restaurant Valdemar
SELECT 
  b.name,
  bo.kitchen_close_time,
  bo.updated_at,
  wsr.scraped_at,
  wsr.scraper_version
FROM businesses b
LEFT JOIN business_operations bo ON b.id = bo.business_id
LEFT JOIN website_scrape_results wsr ON b.id = wsr.business_id
WHERE b.name LIKE '%Valdemar%'
ORDER BY wsr.scraped_at DESC NULLS LAST
LIMIT 1;
