-- Verify brand profile columns were populated
SELECT 
  business_id,
  -- Core columns
  tone_of_voice IS NOT NULL as has_tone_of_voice,
  content_focus IS NOT NULL as has_content_focus,
  tone_model IS NOT NULL as has_tone_model,
  -- Stage columns
  posting_strategy IS NOT NULL as has_posting_strategy,
  audience_segments IS NOT NULL as has_audience_segments,
  location_intelligence IS NOT NULL as has_location_intelligence,
  commercial_baseline_mode IS NOT NULL as has_commercial_strategy,
  -- V5 JSONB
  brand_profile_v5 IS NOT NULL as has_brand_profile_v5,
  brand_profile_v5->'revenue_drivers' IS NOT NULL as has_revenue_drivers,
  -- Show first 100 chars of tone_of_voice
  LEFT(tone_of_voice, 100) as tone_of_voice_preview
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
