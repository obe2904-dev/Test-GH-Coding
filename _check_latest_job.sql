SELECT 
  id,
  url,
  scraped_at,
  payload->>'status' as status,
  scraper_version,
  business_id,
  created_at
FROM website_scrape_results
WHERE url = 'https://soukaarhus.dk/da'
ORDER BY created_at DESC
LIMIT 3;
