-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Trigger Configuration Outdoor Seating Error
-- ═══════════════════════════════════════════════════════════════════════════
-- Issue: WEATHER_BREAK disabled with incorrect reasoning "no outdoor seating"
-- Source of Truth: business_operations.has_outdoor_seating = TRUE
-- Impact: Will suppress weather-triggered suggestions when trigger logic goes live
-- Priority: MEDIUM (dormant now, HIGH when wired)
-- Date: June 12, 2026

-- 1. Verify current state and conflict
SELECT 
  business_id,
  (trigger_configuration->'WEATHER_BREAK'->>'enabled')::boolean as weather_break_enabled,
  trigger_configuration->'WEATHER_BREAK'->>'reasoning' as weather_break_reasoning,
  (trigger_configuration->'FD_WEEK'->>'enabled')::boolean as fd_week_enabled,
  trigger_configuration->'FD_WEEK'->>'reasoning' as fd_week_reasoning
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected result:
-- weather_break_enabled: false ❌
-- weather_break_reasoning: "Not applicable as the café does not have outdoor seating."
-- fd_week_reasoning: "Not relevant for a café without outdoor seating or a kids menu."

-- 2. Verify source of truth
SELECT 
  business_id,
  has_outdoor_seating
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected result:
-- has_outdoor_seating: true ✅

-- 3. Fix WEATHER_BREAK trigger
UPDATE business_brand_profile
SET 
  trigger_configuration = jsonb_set(
    jsonb_set(
      trigger_configuration,
      '{WEATHER_BREAK,enabled}',
      'true'
    ),
    '{WEATHER_BREAK,reasoning}',
    '"Relevant for outdoor seating by the river - weather drives foot traffic to waterfront location"'
  ),
  trigger_updated_by = 'manual_fix_outdoor_seating',
  trigger_updated_at = NOW()
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Verify fix
SELECT 
  business_id,
  (trigger_configuration->'WEATHER_BREAK'->>'enabled')::boolean as weather_break_enabled,
  trigger_configuration->'WEATHER_BREAK'->>'reasoning' as weather_break_reasoning,
  trigger_updated_by,
  trigger_updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected result:
-- weather_break_enabled: true ✅
-- weather_break_reasoning: "Relevant for outdoor seating by the river..."
-- trigger_updated_by: manual_fix_outdoor_seating

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- - This is a quick manual fix for the outdoor seating error
-- - FD_WEEK (Father's Day) also has the same error but kids_menu is correctly false
-- - For full AI regeneration, run: node _regenerate_trigger_config.mjs
-- - Full regeneration recommended to ensure consistency with other trigger logic
-- ═══════════════════════════════════════════════════════════════════════════
