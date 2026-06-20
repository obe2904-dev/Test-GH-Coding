-- =====================================================
-- Migration: Add revenue_drivers to business_brand_profile
-- Date: 2026-06-07
-- 
-- Enables AI-inferred revenue moments for business-first
-- Weekly Plan day allocation.
-- =====================================================

-- ── 1. Add revenue_drivers column ────────────────────
ALTER TABLE business_brand_profile 
  ADD COLUMN IF NOT EXISTS revenue_drivers JSONB;

COMMENT ON COLUMN business_brand_profile.revenue_drivers IS 
  'AI-analyzed revenue moments from business_about. Contains primary/secondary revenue moments, decision windows, posting strategies. Used by Weekly Plan Business Rules Engine.';

-- ── 2. Create GIN index for JSON queries ─────────────
CREATE INDEX IF NOT EXISTS idx_business_brand_profile_revenue_drivers
  ON business_brand_profile USING GIN (revenue_drivers);

COMMENT ON INDEX idx_business_brand_profile_revenue_drivers IS
  'Performance index for querying revenue_drivers JSONB fields (e.g., primary_revenue_moment, normal_week_strategy)';

-- ── 3. Verify migration ───────────────────────────────
DO $$
DECLARE
  column_exists BOOLEAN;
  index_exists BOOLEAN;
BEGIN
  -- Check column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_brand_profile'
      AND column_name = 'revenue_drivers'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ revenue_drivers column exists';
  ELSE
    RAISE WARNING '⚠️  revenue_drivers column not found!';
  END IF;
  
  -- Check index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'business_brand_profile'
      AND indexname = 'idx_business_brand_profile_revenue_drivers'
  ) INTO index_exists;
  
  IF index_exists THEN
    RAISE NOTICE '✅ GIN index created successfully';
  ELSE
    RAISE WARNING '⚠️  Index not found!';
  END IF;
END $$;

-- ── 4. Display schema ─────────────────────────────────
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name = 'revenue_drivers';
