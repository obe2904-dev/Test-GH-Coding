-- ============================================================================
-- ADD COUNTRY COLUMN TO BUSINESSES TABLE
-- ============================================================================
-- Purpose: Replace primary_language as the main geographic field with country
-- Reason: Country determines vacations, holidays, seasons, culture (not language)
-- ============================================================================

-- Add country column
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Set country based on existing primary_language values
UPDATE businesses
SET country = CASE 
  WHEN primary_language = 'da' THEN 'DK'  -- Danish → Denmark
  WHEN primary_language = 'sv' THEN 'SE'  -- Swedish → Sweden
  WHEN primary_language = 'no' THEN 'NO'  -- Norwegian → Norway
  WHEN primary_language = 'fi' THEN 'FI'  -- Finnish → Finland
  WHEN primary_language = 'de' THEN 'DE'  -- German → Germany
  WHEN primary_language = 'en' THEN 'GB'  -- English → UK (default, can be changed per business)
  WHEN primary_language = 'fr' THEN 'FR'  -- French → France
  WHEN primary_language = 'es' THEN 'ES'  -- Spanish → Spain
  WHEN primary_language = 'it' THEN 'IT'  -- Italian → Italy
  WHEN primary_language = 'nl' THEN 'NL'  -- Dutch → Netherlands
  ELSE 'DK' -- Default to Denmark
END
WHERE country IS NULL;

-- Add NOT NULL constraint after populating
ALTER TABLE businesses
ALTER COLUMN country SET NOT NULL;

-- Add default for new businesses
ALTER TABLE businesses
ALTER COLUMN country SET DEFAULT 'DK';

-- Add index for faster country-based queries
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country);

-- Verify the change
SELECT 
  '=== VERIFICATION: BUSINESSES WITH COUNTRY ===' as section;

SELECT 
  id,
  name,
  country,
  primary_language,
  category
FROM businesses
LIMIT 10;

-- Check your test business specifically
SELECT 
  '=== YOUR TEST BUSINESS ===' as section;

SELECT 
  id,
  name,
  country,
  primary_language,
  category
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';
