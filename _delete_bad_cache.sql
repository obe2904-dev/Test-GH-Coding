-- Delete cached scrape with 404 error
-- This forces a fresh scrape on next button click

DELETE FROM website_scrape_results 
WHERE id = '33be4cb7-7050-4723-8d45-36d341b265f0'
AND business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- Verify it's gone
SELECT id, scraped_at, extracted_data 
FROM website_scrape_results 
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY scraped_at DESC 
LIMIT 3;
