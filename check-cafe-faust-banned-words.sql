-- Check which banned words appear in Café Faust's website content
-- Business ID: 82f7b70d-0a72-4888-8ba7-6dc1d34e8db8

-- First, get the business info
SELECT 
  b.id,
  b.name
FROM businesses b
WHERE b.id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- Get website analysis data
SELECT 
  wa.business_id,
  wa.homepage_content,
  wa.about_content,
  wa.about_block,
  wa.hero_texts,
  wa.headers,
  wa.cta_texts,
  wa.nav_items,
  wa.keywords,
  wa.created_at
FROM website_analyses wa
WHERE wa.business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- Check for specific banned words in homepage_content
-- Banned words: hyggelig, hyggeligt, lækker, lækkert, lækre, indbydende, 
--               afslappet, afslappede, autentisk, autentiske, unik, unikke, 
--               fantastisk, fantastiske, vidunderlig, vidunderlige, charmerende

WITH banned_words AS (
  SELECT unnest(ARRAY[
    'hyggelig', 'hyggeligt', 'lækker', 'lækkert', 'lækre', 
    'indbydende', 'afslappet', 'afslappede', 'autentisk', 'autentiske',
    'unik', 'unikke', 'fantastisk', 'fantastiske', 
    'vidunderlig', 'vidunderlige', 'charmerende'
  ]) AS word
),
website_data AS (
  SELECT 
    business_id,
    LOWER(
      COALESCE(homepage_content, '') || ' ' ||
      COALESCE(about_content, '') || ' ' ||
      COALESCE(about_block, '') || ' ' ||
      COALESCE(array_to_string(hero_texts, ' '), '') || ' ' ||
      COALESCE(array_to_string(headers, ' '), '') || ' ' ||
      COALESCE(array_to_string(cta_texts, ' '), '') || ' ' ||
      COALESCE(array_to_string(nav_items, ' '), '') || ' ' ||
      COALESCE(array_to_string(keywords, ' '), '')
    ) AS full_text
  FROM website_analyses
  WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8'
)
SELECT 
  bw.word AS banned_word,
  (
    SELECT COUNT(*)
    FROM regexp_matches(wd.full_text, '\y' || bw.word || '\y', 'g')
  ) AS occurrence_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM regexp_matches(wd.full_text, '\y' || bw.word || '\y', 'g')) >= 2 
    THEN '✅ ALLOWED (2+ occurrences)'
    WHEN (SELECT COUNT(*) FROM regexp_matches(wd.full_text, '\y' || bw.word || '\y', 'g')) > 0
    THEN '⚠️ FOUND but < 2 occurrences'
    ELSE '❌ NOT FOUND'
  END AS status
FROM banned_words bw
CROSS JOIN website_data wd
ORDER BY occurrence_count DESC, banned_word;

-- Show sample text from homepage_content
SELECT 
  business_id,
  LEFT(homepage_content, 500) AS homepage_preview,
  LEFT(about_content, 300) AS about_preview,
  hero_texts,
  headers[1:3] AS first_3_headers
FROM website_analyses
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
