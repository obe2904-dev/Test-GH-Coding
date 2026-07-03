-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1 MIGRATION: Add brand_profile_v5 JSONB Column
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: May 9, 2026
-- Purpose: Add main V5 JSONB column - single source of truth for all 5 layers
--
-- EXECUTE AFTER: 20260508_integrate_voice_v5.sql (Phase 0)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add main V5 JSONB column
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS brand_profile_v5 JSONB;

-- 2. Add metadata columns (create if they don't exist from Phase 0)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS brand_profile_v5_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brand_profile_v5_version TEXT DEFAULT '5.0';

-- 3. Add JSONB indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_brand_profile_v5_version 
  ON business_brand_profile ((brand_profile_v5->>'version'));

CREATE INDEX IF NOT EXISTS idx_brand_profile_v5_generated_at 
  ON business_brand_profile (brand_profile_v5_generated_at DESC);

-- 4. Add validation constraint (ensure version exists if profile exists)
ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_v5_has_version 
  CHECK (
    brand_profile_v5 IS NULL OR 
    (brand_profile_v5->>'version') IS NOT NULL
  );

-- 5. Add comments
COMMENT ON COLUMN business_brand_profile.brand_profile_v5 IS 
  'V5 Brand Profile - Complete 5-layer structure in JSONB. Single source of truth.
   
   Structure:
   {
     "version": "5.0",
     "generated_at": "2026-05-09T10:00:00Z",
     "programmes": [{...}],        // Layer 1-2-4: Programme detection, commercial orientation, audience segments
     "identity": {...},            // Layer 3: Brand essence, positioning, core values
     "voice": {...},               // Layer 5a: Tone rules, personality traits, formality
     "writing_examples": {...},    // Layer 5b: Typical openings/closings, signature phrases
     "guardrails": {...}           // Layer 5c: Never say, content exclusions, factual constraints
   }
   
   REPLACES: business_programme_profiles table + individual legacy columns
   CONSUMERS: V5 Profile Reader service → Weekly Plan, Content Generation, Post Helpers';

COMMENT ON COLUMN business_brand_profile.brand_profile_v5_generated_at IS 
  'Timestamp when brand_profile_v5 was last generated. NULL if never generated.';

COMMENT ON COLUMN business_brand_profile.brand_profile_v5_version IS 
  'V5 schema version (e.g., "5.0", "5.1"). Used for forward compatibility when schema evolves.';

-- 6. Create view for easier querying (optional, for debugging/reporting)
CREATE OR REPLACE VIEW v5_profile_summary AS
SELECT 
  bbp.business_id,
  b.name as business_name,
  bbp.brand_profile_v5->>'version' as v5_version,
  bbp.brand_profile_v5_generated_at,
  jsonb_array_length(bbp.brand_profile_v5->'programmes') as programme_count,
  bbp.brand_profile_v5->'identity'->>'brand_essence' as brand_essence,
  jsonb_array_length(bbp.brand_profile_v5->'voice'->'tone_rules') as tone_rules_count,
  jsonb_array_length(bbp.brand_profile_v5->'writing_examples'->'typical_openings') as typical_openings_count,
  jsonb_array_length(bbp.brand_profile_v5->'guardrails'->'never_say') as never_say_count,
  CASE 
    WHEN bbp.brand_profile_v5 IS NULL THEN 'Not Generated'
    WHEN bbp.brand_profile_v5->'voice' IS NULL THEN 'Partial (Layers 1-4 only)'
    ELSE 'Complete (All 5 layers)'
  END as completeness_status
FROM business_brand_profile bbp
LEFT JOIN businesses b ON bbp.business_id = b.id;

COMMENT ON VIEW v5_profile_summary IS 
  'Summary view of V5 profile status across all businesses. Useful for monitoring migration progress.';

-- 7. Verify migration
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'business_brand_profile' AND column_name = 'brand_profile_v5'
    )
    THEN '✅ SUCCESS: brand_profile_v5 column added'
    ELSE '❌ ERROR: brand_profile_v5 not found'
  END as migration_status;

-- 8. Show current state
SELECT * FROM v5_profile_summary;
