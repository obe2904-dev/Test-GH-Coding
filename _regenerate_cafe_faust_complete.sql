-- Regenerate Café Faust brand profile with new validation
-- This will generate clean social_writing_examples

-- Option 1: Via Edge Function (recommended)
-- Copy this URL and open in browser:
-- https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5?business_id=f4679fa9-3120-4a59-9506-d059b010c34a&force=true

-- Option 2: Via database trigger (if you have one set up)
UPDATE businesses 
SET updated_at = NOW()
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- After regeneration, check the new examples:
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'social_writing_examples') as social_examples,
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_examples') as menu_examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
