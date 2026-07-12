-- Clear cache for Souk Aarhus website to force fresh scraping
-- This allows the AI to re-analyze the website content

DELETE FROM scraped_cache
WHERE url IN (
  'https://soukaarhus.dk/da',
  'https://soukaarhus.dk/',
  'http://soukaarhus.dk/da',
  'http://soukaarhus.dk/'
);

-- Verify deletion
SELECT url, scraper_type, scraped_at, status
FROM scraped_cache
WHERE url LIKE '%soukaarhus%'
ORDER BY scraped_at DESC;
