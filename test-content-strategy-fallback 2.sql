-- Test content_strategy fallback
-- This will regenerate the brand profile for Café Faust and check if content_strategy is populated

-- First, delete existing brand profile to force regeneration
DELETE FROM public.business_brand_profile WHERE business_id = 'bb8f4dc5-d091-4906-a0f9-1c9f5cdd6ae2';

-- Wait a moment, then regenerate by calling the function via HTTP
-- You'll need to run this in the terminal instead:
-- curl -i --location --request POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator' \
--   --header 'Authorization: Bearer YOUR_ANON_KEY' \
--   --header 'Content-Type: application/json' \
--   --data '{"businessId":"bb8f4dc5-d091-4906-a0f9-1c9f5cdd6ae2","force":true}'

-- After regeneration, check if content_strategy is populated:
SELECT 
  business_id,
  (brand_voice->>'content_strategy') IS NOT NULL as has_content_strategy,
  jsonb_pretty(brand_voice->'content_strategy') as content_strategy_pretty
FROM public.business_brand_profile 
WHERE business_id = 'bb8f4dc5-d091-4906-a0f9-1c9f5cdd6ae2';
