-- ADD_TYPICAL_OPENINGS_LOCKED_COLUMN.sql
-- Adds typical_openings_locked to business_brand_profile
--
-- Purpose: Allow business owners to lock their typical_openings so AI regeneration
--   does not overwrite manually curated opening phrases.
--
--   Default: FALSE — AI regeneration ALWAYS refreshes typical_openings on each run.
--   Set TRUE: typical_openings survive regeneration unchanged (owner has manually edited them).
--
-- This replaces the old implicit write-once guard (hasExistingTypicalOpenings).
-- The old guard caused stale AI-generated openings from previous prompt versions
-- to persist indefinitely through all subsequent regenerations.
--
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS typical_openings_locked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN business_brand_profile.typical_openings_locked IS
  'When TRUE, the AI brand-profile-generator will NOT overwrite typical_openings on regeneration. '
  'Set to TRUE when a business owner manually edits their opening phrases via the dashboard. '
  'Default FALSE: AI always refreshes typical_openings from the latest Eksempel: lines in tone_of_voice.';
