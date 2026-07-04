-- Fix menu source labels to extract proper names from URLs
-- This updates all "Menusiden" labels to meaningful names like "Brunch", "Aften", etc.

-- Update based on URL patterns (same logic as detectMenuLabel function)
UPDATE menu_sources
SET label = CASE
  -- Specific menu types (check these first, most specific)
  WHEN LOWER(source_url) LIKE '%julefrokost%' THEN 'Julefrokost'
  WHEN LOWER(source_url) LIKE '%brunch%' THEN 'Brunch'
  WHEN LOWER(source_url) LIKE '%frokost%' OR LOWER(source_url) LIKE '%lunch%' THEN 'Frokost'
  WHEN LOWER(source_url) LIKE '%aften%' THEN 'Aftenmenu'
  WHEN LOWER(source_url) LIKE '%middag%' OR LOWER(source_url) LIKE '%dinner%' THEN 'Middag'
  WHEN LOWER(source_url) LIKE '%morgenmad%' THEN 'Morgenmad'
  WHEN LOWER(source_url) LIKE '%cocktail%' THEN 'Cocktails'
  WHEN LOWER(source_url) LIKE '%drinks%' THEN 'Drikkevarer'
  WHEN LOWER(source_url) LIKE '%vin%' OR LOWER(source_url) LIKE '%wine%' THEN 'Vinkort'
  -- Generic menu (last resort)
  WHEN LOWER(source_url) LIKE '%menu%' THEN 'Menukort'
  ELSE 'Menukort'
END
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Verify the updates
SELECT 
  source_url,
  label,
  menu_type
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;
