-- Consolidated: Apply 4 critical migrations manually
-- Run this in Supabase SQL Editor or via psql

-- ============================================================================
-- Migration 1/4: 20260211000003_add_strategy_id_to_content_plans
-- ============================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_content_plans') THEN
    ALTER TABLE weekly_content_plans 
    ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES weekly_strategies(id);

    COMMENT ON COLUMN weekly_content_plans.strategy_id IS 
      'Link to Layer 0 strategy that drove this plan. NULL for legacy plans generated without Layer 0.';

    CREATE INDEX IF NOT EXISTS idx_weekly_content_plans_strategy_id 
      ON weekly_content_plans(strategy_id) 
      WHERE strategy_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Migration 2/4: 20260420000007_drop_unused_tables
-- ============================================================================
-- Drop unused tables confirmed empty (0 rows) or never populated (schema-only)
-- All verified: zero reads in src/ and supabase/functions/ — April 2026

-- Tables confirmed 0 rows in table-stats
DROP TABLE IF EXISTS content_performance_log CASCADE;
DROP TABLE IF EXISTS opportunity_tracking CASCADE;
DROP TABLE IF EXISTS post_approvals CASCADE;
DROP TABLE IF EXISTS post_drafts CASCADE;
DROP TABLE IF EXISTS menu_extractions CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS business_team_members CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS content_type_baselines CASCADE;

-- Tables that did not appear in table-stats (schema-only or never created)
DROP TABLE IF EXISTS business_audience_profile CASCADE;
DROP TABLE IF EXISTS business_menu_metadata CASCADE;
DROP TABLE IF EXISTS business_goals CASCADE;
DROP TABLE IF EXISTS specials CASCADE;
DROP TABLE IF EXISTS business_staff CASCADE;
DROP TABLE IF EXISTS weather_cache CASCADE;
DROP TABLE IF EXISTS platform_intelligence CASCADE;

-- ============================================================================
-- Migration 3/4: 20260501000003_canonicalize_programme_names
-- ============================================================================
-- Task 3.2: Canonicalize Programme Names in audience_framework.timeSlots
-- 
-- Purpose: Normalize programme name variations (e.g., "Brunch", "Morgenmad", "Breakfast")
-- to prevent rotation tracking fragmentation.
-- 
-- Background: AI-extracted menu data produces inconsistent programme names across different
-- menu sources. This migration standardizes existing data to canonical forms.
--
-- Safe to run multiple times (idempotent).

-- Create canonicalization function that mirrors TypeScript logic
CREATE OR REPLACE FUNCTION canonicalize_programme(programme_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Normalize to lowercase and trim
  normalized := LOWER(TRIM(programme_name));
  
  -- Brunch / Morning variations → 'brunch'
  IF normalized IN ('brunch', 'morgenmad', 'breakfast', 'morgenkaffe', 'morgenmenu', 'morning') THEN
    RETURN 'brunch';
  
  -- Lunch variations → 'frokost'
  ELSIF normalized IN ('frokost', 'lunch', 'lunsj', 'middagsmad') THEN
    RETURN 'frokost';
  
  -- Dinner variations → 'aftensmad'
  ELSIF normalized IN ('aftensmad', 'dinner', 'middag', 'aftenmenu', 'evening') THEN
    RETURN 'aftensmad';
  
  -- Bar / Drinks variations → 'cocktails'
  ELSIF normalized IN ('cocktails', 'bar', 'drinks', 'natmenu', 'nightlife', 'aften bar') THEN
    RETURN 'cocktails';
  
  -- Dessert / Sweet variations → 'dessert'
  ELSIF normalized IN ('dessert', 'kage', 'cake', 'kaffe & kage', 'eftermiddagskaffe') THEN
    RETURN 'dessert';
  
  -- No mapping found - return normalized form
  ELSE
    RETURN normalized;
  END IF;
END;
$$;

COMMENT ON FUNCTION canonicalize_programme IS 'Task 3.2: Normalize programme name variations to canonical forms (e.g., Morgenmad → brunch). Matches TypeScript canonicalizeProgramme() logic.';

-- Update existing audience_framework.timeSlots to canonicalize programme names
UPDATE business_brand_profile
SET audience_framework = jsonb_build_object(
    'timeSlots', (
      SELECT jsonb_agg(
        CASE 
          WHEN slot ? 'programmes' THEN
            jsonb_set(
              slot,
              '{programmes}',
              (
                -- Canonicalize each programme in the array and deduplicate
                SELECT jsonb_agg(DISTINCT canonical_prog ORDER BY canonical_prog)
                FROM (
                  SELECT canonicalize_programme(prog::TEXT) AS canonical_prog
                  FROM jsonb_array_elements_text(slot->'programmes') AS prog
                  WHERE prog::TEXT IS NOT NULL AND prog::TEXT != ''
                ) AS canonicalized
              )
            )
          ELSE
            slot
        END
      )
      FROM jsonb_array_elements(business_brand_profile.audience_framework->'timeSlots') AS slot
    ),
    'primaryAudiences', COALESCE(business_brand_profile.audience_framework->'primaryAudiences', '[]'::jsonb),
    'locationContexts', COALESCE(business_brand_profile.audience_framework->'locationContexts', '[]'::jsonb),
    'seasonalVariation', COALESCE(business_brand_profile.audience_framework->'seasonalVariation', 'null'::jsonb),
    'complexity', COALESCE(business_brand_profile.audience_framework->'complexity', 'null'::jsonb)
  )
WHERE 
  audience_framework IS NOT NULL 
  AND audience_framework->'timeSlots' IS NOT NULL
  AND jsonb_array_length(audience_framework->'timeSlots') > 0;

-- Log summary of changes
DO $$
DECLARE
  updated_count INT;
  total_with_framework INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM business_brand_profile
  WHERE audience_framework->'timeSlots' IS NOT NULL;
  
  SELECT COUNT(*) INTO total_with_framework
  FROM business_brand_profile
  WHERE audience_framework IS NOT NULL;
  
  RAISE NOTICE 'Task 3.2 Migration Complete:';
  RAISE NOTICE '  - % businesses with audience_framework', total_with_framework;
  RAISE NOTICE '  - % businesses with timeSlots updated', updated_count;
  RAISE NOTICE '  - Programme names canonicalized to: brunch, frokost, aftensmad, cocktails, dessert';
END $$;

-- ============================================================================
-- Migration 4/4: 20260519000000_add_local_location_reference_to_onboarding
-- ============================================================================
-- ============================================================================
-- ADD LOCAL_LOCATION_REFERENCE TO create_business_onboarding FUNCTION
-- ============================================================================
-- Adds optional local_location_reference parameter to onboarding function
-- Allows website analysis to auto-populate authentic local place names
-- ============================================================================

-- Update create_business_onboarding function to include local_location_reference
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[],
  p_website_url TEXT DEFAULT NULL,
  p_local_location_reference TEXT DEFAULT NULL  -- NEW: Optional local place name
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record with optional website_url and local_location_reference
  -- NOTE: business_type_hybrid is populated separately via analyze-website call
  INSERT INTO public.businesses (
    owner_id,
    name,
    website_url,
    local_location_reference,  -- NEW: Store local place name if provided
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_website_url,
    p_local_location_reference,  -- NEW: Can be NULL if not extracted/provided
    'da', -- Danish default
    'free', -- Free tier by default
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Create business location record
  INSERT INTO public.business_locations (
    business_id,
    postal_code,
    city,
    country,
    is_primary,
    created_at
  )
  VALUES (
    v_business_id,
    p_postal_code,
    p_city,
    p_country,
    TRUE, -- First location is primary
    NOW()
  );

  -- Store selected platforms in profiles for backward compatibility
  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(p_selected_platforms),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Removed p_business_vertical parameter (replaced by business_type_hybrid)
--    - business_type_hybrid is populated separately via analyze-website
--    - No hardcoded defaults - NULL if not detected
--
-- 2. Backward compatible: p_local_location_reference has DEFAULT NULL
--    - Old calls will work (local_location_reference will be NULL)
--    - New calls can include local_location_reference
--
-- 3. Auto-population flow:
--    - OnboardingPage analyzes website → extractBasicInfo returns localLocationReference
--    - OnboardingPage passes it to create_business_onboarding
--    - Stored in businesses.local_location_reference
--    - Used by brand-profile-generator-v5 for all AI prompts
--
-- 4. Examples of extracted values:
--    - "ved åen" (from "Café beliggende ved åen i Aarhus")
--    - "Nyhavn" (from "Restaurant lige midt i Nyhavn")
--    - "i Vesterbro" (from "Bar i Vesterbro")
-- ============================================================================

-- ============================================================================
-- Mark migrations as applied in history
-- ============================================================================
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20260211000003'),
  ('20260420000007'),
  ('20260501000003'),
  ('20260519000000')
ON CONFLICT (version) DO NOTHING;
