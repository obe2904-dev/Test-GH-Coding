-- Fix Tourist Grounding Issue: Clear Cache for Re-Analysis
-- 
-- ISSUE: Aarhus Domkirke being cited as tourist attraction when it's not significant
-- FIX: Added POI significance filter to AI prompt, now need to re-analyze
--
-- This script:
-- 1. Clears who.notes for locations with invalid tourist grounding (churches/cathedrals)
-- 2. Resets last_updated_by_ai to force re-analysis on next visit

-- Step 1: Identify locations with potentially invalid tourist grounding
SELECT 
  bli.business_id,
  b.business_name,
  bli.who->'notes' as who_notes,
  bli.last_updated_by_ai
FROM business_location_intelligence bli
JOIN businesses b ON b.id = bli.business_id
WHERE 
  bli.who->'notes' IS NOT NULL 
  AND (
    bli.who->'notes'::text ILIKE '%domkirke%'
    OR bli.who->'notes'::text ILIKE '%cathedral%'
    OR bli.who->'notes'::text ILIKE '%kirke%'
  )
  AND (
    bli.who->'notes'::text ILIKE '%turister%'
    OR bli.who->'notes'::text ILIKE '%tourist%'
  );

-- Step 2: Clear invalid tourist grounding notes
-- (Only clears notes, preserves all other data)
UPDATE business_location_intelligence
SET 
  who = jsonb_set(who, '{notes}', 'null'::jsonb),
  last_updated_by_ai = NULL  -- Force re-analysis
WHERE 
  who->'notes' IS NOT NULL 
  AND (
    who->'notes'::text ILIKE '%domkirke%'
    OR who->'notes'::text ILIKE '%cathedral%'
    OR who->'notes'::text ILIKE '%kirke%'
  )
  AND (
    who->'notes'::text ILIKE '%turister%'
    OR who->'notes'::text ILIKE '%tourist%'
  );

-- Step 3: Verify the fix
SELECT 
  bli.business_id,
  b.business_name,
  bli.who->'notes' as who_notes,
  bli.last_updated_by_ai
FROM business_location_intelligence bli
JOIN businesses b ON b.id = bli.business_id
WHERE bli.last_updated_by_ai IS NULL;

-- To manually trigger re-analysis for a specific business:
-- Use the Supabase Edge Function:
-- POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence
-- {
--   "business_id": "<business_id>",
--   "force_refresh": true
-- }
