-- Check the status of the specific scrape job
SELECT 
  id,
  business_id,
  url,
  scraped_at,
  scraper_version,
  content_quality,
  menu_source,
  payload->>'status' as payload_status,
  payload->>'started_at' as started_at,
  payload
FROM website_scrape_results
WHERE id = 'b79e4db4-10ad-4b40-af82-7af045df3409';
