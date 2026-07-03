-- =============================================================================
-- SCHEMA COMMENTS v17: Document field status and usage
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- =============================================================================

-- ✅ ENRICHED FIELDS (PRIMARY - use these for AI caption generation)
COMMENT ON COLUMN business_brand_profile.never_say IS 
'✅ PRIMARY: Array of banned words/phrases in Danish. Used by AI caption generator. Contains 107 terms including generic café phrases like "kom forbi", "nyd", "kaffepause". Populated by brand profile generator v4.8+';

COMMENT ON COLUMN business_brand_profile.signature_phrases IS
'✅ PRIMARY: Brand-specific phrases that should appear in captions (e.g., "ved åen i Aarhus"). Used by AI caption generator to maintain brand consistency.';

COMMENT ON COLUMN business_brand_profile.typical_openings IS
'✅ PRIMARY: Example opening sentences for captions. Used by AI to learn tone without copying verbatim.';

COMMENT ON COLUMN business_brand_profile.typical_closings IS
'✅ PRIMARY: Example closing sentences for captions. Often includes specific CTAs like "Vi ses ☕".';

COMMENT ON COLUMN business_brand_profile.humor_level IS
'✅ PRIMARY: Humor level (none/subtle/playful/bold). Used by AI to match brand personality. Values: none, subtle, playful, bold.';

COMMENT ON COLUMN business_brand_profile.formality IS
'✅ PRIMARY: Formality level (casual/professional/formal). Used by AI tone control. Values: casual, professional, formal.';

COMMENT ON COLUMN business_brand_profile.emoji_style IS
'✅ PRIMARY: Emoji usage preference (none/minimal/moderate/expressive). Used by AI caption generator. Values: none, minimal, moderate, expressive.';

COMMENT ON COLUMN business_brand_profile.storytelling_style IS
'✅ PRIMARY: Storytelling depth (minimal/some_context/detailed). Used by AI to determine caption length and context. Values: minimal, some_context, detailed.';

-- ⚠️ DEPRECATED FIELDS (Superseded by enriched fields - remove after Q2 2026)
COMMENT ON COLUMN business_brand_profile.do_not_say IS
'⚠️ DEPRECATED: Replaced by never_say array. This JSONB field ({words: []}) is no longer populated. Use never_say instead. Scheduled for removal: Q2 2026.';

COMMENT ON COLUMN business_brand_profile.things_to_avoid IS
'⚠️ DEPRECATED: Replaced by never_say array. This JSON string field contained 3 items with explanations. Content merged into never_say. Scheduled for removal: Q2 2026.';

COMMENT ON COLUMN business_brand_profile.tone_keywords IS
'⚠️ DEPRECATED: Simple tone keywords (e.g., "friendly", "welcoming"). Superseded by structured personality traits (humor_level, formality). Still used by some legacy code paths. Consider migration to enriched fields.';

COMMENT ON COLUMN business_brand_profile.voice_style IS
'⚠️ DEPRECATED: Free-text voice description (e.g., "Venlig og imødekommende"). Superseded by structured fields (formality, humor_level, storytelling_style). Still used by some legacy code paths.';

-- 📊 METADATA FIELDS
COMMENT ON COLUMN business_brand_profile.voice_extraction_source IS
'📊 METADATA: Source of voice extraction (ai_gpt4o, ai_gpt4o_hybrid, manual). Used for quality tracking and debugging.';

COMMENT ON COLUMN business_brand_profile.voice_extracted_at IS
'📊 METADATA: Timestamp when brand voice was last extracted. Used to determine staleness.';

COMMENT ON COLUMN business_brand_profile.voice_confidence_score IS
'📊 METADATA: AI confidence score (0-100) for voice extraction quality. Scores below 70 may indicate unreliable data.';

COMMENT ON COLUMN business_brand_profile.updated_at IS
'📊 METADATA: Last update timestamp for any brand profile field. Auto-updated on changes.';

-- ❌ UNUSED/UNDERUSED FIELDS (Audit for removal consideration)
COMMENT ON COLUMN business_brand_profile.booking_link IS
'❌ UNUSED: Booking URL. Populated by onboarding but rarely used in caption generation. Last audit: 2026-02-17.';

COMMENT ON COLUMN business_brand_profile.business_voice IS
'❌ UNUSED: Legacy voice field. Not used in current AI flows. Last audit: 2026-02-17.';

COMMENT ON COLUMN business_brand_profile.cta_preference IS
'❌ UNUSED: CTA preference (soft/medium/strong). Populated but not actively used in caption generation. Last audit: 2026-02-17.';

COMMENT ON COLUMN business_brand_profile.offerings_full IS
'❌ UNDERUSED: Full business offerings description. Only used in brand profile generation, not caption flow. Last audit: 2026-02-17.';

COMMENT ON COLUMN business_brand_profile.values IS
'❌ UNDERUSED: Brand values array. Populated by brand profile generator but rarely used in caption generation. Often empty. Last audit: 2026-02-17.';

COMMENT ON COLUMN business_brand_profile.certifications IS
'❌ UNDERUSED: Business certifications array. Populated by brand profile generator but rarely used in caption generation. Often empty. Last audit: 2026-02-17.';

-- 🔧 SEMI-ACTIVE FIELDS (Used by brand profile generator but not caption flow)
COMMENT ON COLUMN business_brand_profile.tone_of_voice IS
'🔧 SEMI-ACTIVE: Used by brand profile generation but not directly in caption flow. Consider consolidation with voice_style.';

COMMENT ON COLUMN business_brand_profile.personality IS
'🔧 SEMI-ACTIVE: JSONB personality details used by brand profile generator. Contains structured personality data. Partially overlaps with humor_level/formality columns.';

-- =============================================================================
-- VERIFICATION: Check comments were applied
-- =============================================================================

SELECT 
  cols.column_name,
  pgd.description as comment
FROM pg_catalog.pg_statio_all_tables as st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns cols ON (
  pgd.objsubid = cols.ordinal_position
  AND cols.table_schema = st.schemaname
  AND cols.table_name = st.relname
)
WHERE st.relname = 'business_brand_profile'
  AND cols.column_name IN (
    'never_say', 'signature_phrases', 'typical_openings', 'humor_level', 
    'formality', 'do_not_say', 'things_to_avoid', 'tone_keywords', 'voice_style'
  )
ORDER BY 
  CASE 
    WHEN pgd.description LIKE '✅%' THEN 1
    WHEN pgd.description LIKE '⚠️%' THEN 2
    WHEN pgd.description LIKE '📊%' THEN 3
    WHEN pgd.description LIKE '❌%' THEN 4
    WHEN pgd.description LIKE '🔧%' THEN 5
    ELSE 6
  END,
  cols.column_name;
