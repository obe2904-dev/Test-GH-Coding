-- VERIFY DATABASE SCHEMA FOR LAYER 0 STORAGE
-- Purpose: Ensure brand_profile_v5.layer_0_intelligence structure is correct for HYBRID approach

-- 1. Check table structure
\d brand_profile_v5

-- 2. Check layer_0_intelligence JSONB structure
SELECT 
  id,
  business_id,
  layer_0_intelligence->>'business_type' as business_type,
  layer_0_intelligence->'business_identity' as business_identity_full,
  layer_0_intelligence->'business_identity'->>'system_persona' as system_persona,
  layer_0_intelligence->'business_identity'->>'target_length' as target_length,
  layer_0_intelligence->'geographic_context' as geographic_context_full,
  layer_0_intelligence->'geographic_context'->>'city' as city,
  layer_0_intelligence->'geographic_context'->>'population' as population,
  layer_0_intelligence->'geographic_context'->>'city_size' as city_size,
  layer_0_intelligence->'professional_persona' as professional_persona_old,
  layer_0_intelligence->'voice_archetype' as voice_archetype,
  created_at,
  updated_at
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Check if we need to add new fields for HYBRID approach
-- Expected structure:
-- layer_0_intelligence: {
--   "business_type": "hybrid_cafe",
--   "business_identity": {
--     "system_persona": "Du er Café Faust...",  // NEW: Business identity (100-150 words)
--     "target_length": 150,
--     "generated_at": "2026-05-20T..."
--   },
--   "geographic_context": {
--     "city": "Aarhus",
--     "postal_code": "8000",
--     "population": 350000,
--     "city_size": "major_city",
--     "cultural_context": "...",
--     "tone": "...",
--     "ai_generated": true,  // NEW: Flag for AI-generated vs hardcoded
--     "cached_until": "2026-08-20"  // NEW: 90-day cache
--   },
--   "professional_persona": {...},  // KEEP for backward compatibility, but won't be used
--   "voice_archetype": {...}
-- }

-- 4. Check if city_context cache table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'city_context_cache'
);

-- 5. If city_context_cache doesn't exist, we need to create it
-- Structure should be:
-- CREATE TABLE IF NOT EXISTS city_context_cache (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   city TEXT NOT NULL,
--   country TEXT NOT NULL DEFAULT 'Denmark',
--   postal_code TEXT,
--   population INTEGER,
--   city_size TEXT, -- 'small_town', 'medium_city', 'major_city', 'capital'
--   cultural_context TEXT, -- AI-generated brief context (20-30 words)
--   tone TEXT, -- Suggested tone
--   ai_generated BOOLEAN DEFAULT true,
--   cached_at TIMESTAMPTZ DEFAULT NOW(),
--   cached_until TIMESTAMPTZ, -- NOW() + 90 days
--   UNIQUE(city, country)
-- );
