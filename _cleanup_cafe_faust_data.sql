-- Clean up all Café Faust contamination from business 450c1b6a-e354-4eef-88d8-86cd2ac8d42b
-- This business should be Souk Aarhus, not Café Faust

BEGIN;

-- 1. Clear business_profile fields with Café Faust data
UPDATE business_profile
SET 
  key_offerings = NULL,  -- Remove Faust Burger, Parisarbøf, etc.
  booking_url = NULL,    -- Remove dinnerbooking.com link
  menu_description = NULL,
  user_about_text = NULL,  -- Will be re-extracted
  long_description = NULL  -- Will be re-extracted
WHERE business_id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';

-- 2. Clear business_locations with Café Faust contact info
UPDATE business_locations
SET 
  phone = NULL,                    -- Remove Café Faust phone
  email = NULL,                    -- Remove info@cafefaust.dk
  address_line1 = NULL,            -- Remove Åboulevarden 38
  postal_code = NULL,
  city = NULL
WHERE business_id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';

-- 3. Update business name and type to correct values
UPDATE businesses
SET 
  name = 'Souk Aarhus',
  website_url = 'https://soukaarhus.dk/da',
  business_type_hybrid = jsonb_build_object(
    'primary', 'restaurant',
    'secondary', ARRAY['middle eastern'],
    'hybridLabel', 'Middle Eastern Restaurant'
  ),
  updated_at = NOW()
WHERE id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';

-- 4. Delete old website_analyses with wrong data
DELETE FROM website_analyses
WHERE business_id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';

COMMIT;

-- Verify the cleanup
SELECT 
  b.name,
  b.website_url,
  b.business_type_hybrid->>'primary' as business_type,
  bp.key_offerings,
  bp.booking_url,
  bp.user_about_text,
  bl.phone,
  bl.email,
  bl.address_line1
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';
