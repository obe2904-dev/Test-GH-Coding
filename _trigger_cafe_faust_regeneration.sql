-- Trigger regeneration for Café Faust
-- This will call the brand-profile-generator-v5 Edge Function

SELECT
  net.http_post(
    url := 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a'
    )
  ) as response;
