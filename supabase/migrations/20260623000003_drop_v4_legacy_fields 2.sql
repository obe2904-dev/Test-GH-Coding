-- Migration: Drop V4-Only Legacy Fields (V5-ONLY Development Cleanup)
-- Created: 2026-06-23
-- Context: Development stage - V5-only architecture, no legacy V4 data concerns
-- 
-- Purpose: Remove 10 V4-only fields from business_brand_profile that:
--   1. Are written ONLY by brand-profile-generator (V4)
--   2. Have V5 equivalents in brand_profile_v5 JSONB
--   3. Cause NULL pollution when V5-only businesses are read by V4-aware code
-- 
-- Strategy: Clean migration for V5-focused codebase
-- 
-- Fields Dropped (10 total):
--   1. business_model_type → V5: layer_0_intelligence.business_category
--   2. audience_breadth → V5: strategic_audience_segments (infer from count)
--   3. classification_rationale → V4 internal field, low value
--   4. voice_style → BUGGY field (was mapped to brand_essence), not needed
--   5. cta_style → Use commercial_baseline_mode instead
--   6. commercial_strategy_reasoning → V4 internal field, low value
--   7. quality_status → V4 internal field
--   8. content_pillars_jsonb → V5: content_strategy.brand_anchors
--   9. brand_essence_elaboration → V5: identity.brand_essence (cleaner)
--  10. values → Rarely used, redundant with brand_essence
-- 
-- Impact: 
--   - Smaller schema (10 fewer columns)
--   - No V4/V5 confusion
--   - Cleaner prompts (no NULL pollution)
--   - Reduced token waste
-- 
-- Related: V5-ONLY-DEVELOPMENT-CLEANUP-PLAN.md

-- Drop 10 V4-only legacy fields
ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS business_model_type,
  DROP COLUMN IF EXISTS audience_breadth,
  DROP COLUMN IF EXISTS classification_rationale,
  DROP COLUMN IF EXISTS voice_style,
  DROP COLUMN IF EXISTS cta_style,
  DROP COLUMN IF EXISTS commercial_strategy_reasoning,
  DROP COLUMN IF EXISTS quality_status,
  DROP COLUMN IF EXISTS content_pillars_jsonb,
  DROP COLUMN IF EXISTS brand_essence_elaboration,
  DROP COLUMN IF EXISTS values;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'V5-ONLY CLEANUP: Dropped 10 V4-only legacy fields from business_brand_profile';
  RAISE NOTICE 'Schema is now V5-focused with clean architecture';
END $$;
