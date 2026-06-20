-- Quick migration: Add local_location_reference columns
-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS local_location_reference text,
ADD COLUMN IF NOT EXISTS local_location_reference_source text CHECK (
  local_location_reference_source IN ('ai_suggested', 'user_provided', 'user_confirmed')
),
ADD COLUMN IF NOT EXISTS local_location_reference_updated_at timestamptz;

-- Update Café Faust
UPDATE business_location_intelligence
SET 
  local_location_reference = 'ved åen',
  local_location_reference_source = 'user_provided',
  local_location_reference_updated_at = NOW()
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Verify
SELECT 
  business_id,
  local_location_reference,
  local_location_reference_source,
  local_location_reference_updated_at
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
