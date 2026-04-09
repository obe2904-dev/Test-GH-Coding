-- Migration: Add brand profile support tables
-- Run this in Supabase SQL editor
-- Fixes two persistent ⚠️ warnings in brand-profile-generator logs:
--   "Could not find the table 'public.brand_profile_generation_locks'"
--   "Could not find the table 'public.brand_profile_sources_state'"

-- 1. Generation lock table
--    Prevents concurrent brand profile regenerations for the same business.
--    One row per business while generation is in progress; deleted on completion.
CREATE TABLE IF NOT EXISTS brand_profile_generation_locks (
  business_id   uuid        NOT NULL PRIMARY KEY,
  request_id    text        NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE brand_profile_generation_locks IS
  'Concurrency lock for brand-profile-generator. One row inserted at start, deleted at finish.';

-- 2. Source hashes state table
--    Tracks content hashes per business to skip regeneration when nothing changed.
CREATE TABLE IF NOT EXISTS brand_profile_sources_state (
  business_id              uuid        NOT NULL PRIMARY KEY,
  version_hash             text,
  business_snapshot_hash   text,
  profile_hash             text,
  website_hash             text,
  location_hash            text,
  images_hash              text,
  menu_hash                text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE brand_profile_sources_state IS
  'Per-business content hashes used to detect whether brand profile regeneration is needed.';

-- 3. RLS: service role only (edge functions use service role key)
ALTER TABLE brand_profile_generation_locks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profile_sources_state      ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions bypass RLS anyway, but good hygiene)
DROP POLICY IF EXISTS "service_role_all" ON brand_profile_generation_locks;
CREATE POLICY "service_role_all" ON brand_profile_generation_locks
  FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all" ON brand_profile_sources_state;
CREATE POLICY "service_role_all" ON brand_profile_sources_state
  FOR ALL USING (true);

-- Verify
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('brand_profile_generation_locks', 'brand_profile_sources_state')
ORDER BY table_name;
