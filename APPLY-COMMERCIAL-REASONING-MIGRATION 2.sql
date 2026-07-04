-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

-- Add commercial_reasoning column to business_programme_profiles
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS commercial_reasoning text;

-- Add column documentation
COMMENT ON COLUMN business_programme_profiles.commercial_reasoning IS 
'Layer 2: AI explanation of why this baseline commercial strategy was chosen (2-3 sentences in Danish)';

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
  AND column_name = 'commercial_reasoning';
