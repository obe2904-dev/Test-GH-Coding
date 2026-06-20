-- Add commercial reasoning field to business_programme_profiles
-- This provides transparency for Layer 2 commercial strategy decisions

ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS commercial_reasoning text;

COMMENT ON COLUMN business_programme_profiles.commercial_reasoning IS 'Layer 2: AI explanation of why this baseline commercial strategy was chosen (2-3 sentences in Danish)';
