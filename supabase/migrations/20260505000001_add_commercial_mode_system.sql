-- =====================================================
-- COMMERCIAL MODE SYSTEM
-- =====================================================
-- Adds commercial objective enforcement to weekly strategy generation.
-- Ensures generated ideas consistently drive footfall, sales, and reservations.
--
-- Phase 1 of 3-issue resolution plan (Priority Issue 1)
-- Generated: 5. maj 2026
-- =====================================================

-- =====================================================
-- PART 1: Business Trigger Configuration
-- =====================================================
-- Store business-specific trigger policies in business_brand_profile

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS trigger_configuration JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trigger_last_updated TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trigger_updated_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commercial_baseline_mode TEXT DEFAULT 'balanced' CHECK (
    commercial_baseline_mode IN ('booking_push', 'footfall_push', 'balanced')
  );

COMMENT ON COLUMN public.business_brand_profile.trigger_configuration IS 
  'Business-specific trigger policies. Maps trigger IDs to configuration: {enabled, mode, min_booking_ideas, min_footfall_ideas, reasoning}. Example: {"VD_WEEK": {"enabled": true, "mode": "booking_push", "min_booking_ideas": 3}}';

COMMENT ON COLUMN public.business_brand_profile.trigger_last_updated IS 
  'Timestamp when trigger_configuration was last modified';

COMMENT ON COLUMN public.business_brand_profile.trigger_updated_by IS 
  'User ID or system identifier that last updated trigger configuration';

COMMENT ON COLUMN public.business_brand_profile.commercial_baseline_mode IS 
  'Default commercial mode when no specific triggers are active. booking_push for reservation-heavy, footfall_push for walk-in, balanced for mixed.';

-- Index for querying businesses by baseline mode
CREATE INDEX IF NOT EXISTS idx_brand_profile_commercial_baseline 
  ON public.business_brand_profile(commercial_baseline_mode);

-- GIN index for trigger configuration queries
CREATE INDEX IF NOT EXISTS idx_brand_profile_trigger_config 
  ON public.business_brand_profile USING GIN (trigger_configuration);

-- =====================================================
-- PART 2: Weekly Strategy Commercial Mode Tracking
-- =====================================================
-- Extend weekly_strategies to track commercial decision-making

ALTER TABLE public.weekly_strategies
  ADD COLUMN IF NOT EXISTS commercial_mode TEXT DEFAULT NULL CHECK (
    commercial_mode IN ('booking_push', 'footfall_push', 'balanced')
  ),
  ADD COLUMN IF NOT EXISTS commercial_mode_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS triggered_by TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_booking_ideas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_footfall_ideas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_validation_score NUMERIC(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commercial_validation_details JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commercial_validation_passed BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commercial_override_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN public.weekly_strategies.commercial_mode IS 
  'Determined commercial mode for this week: booking_push (reservation focus), footfall_push (visit focus), balanced (mixed)';

COMMENT ON COLUMN public.weekly_strategies.commercial_mode_reason IS 
  'Human-readable explanation of why this mode was selected. Example: "Valentine''s Day week - reservation capability enabled and high commercial event"';

COMMENT ON COLUMN public.weekly_strategies.triggered_by IS 
  'Array of trigger IDs that activated for this week. Example: ["VD_WEEK", "LOCAL_EVENT"]';

COMMENT ON COLUMN public.weekly_strategies.min_booking_ideas IS 
  'Minimum number of booking-focused ideas required by commercial mode';

COMMENT ON COLUMN public.weekly_strategies.min_footfall_ideas IS 
  'Minimum number of footfall-focused ideas required by commercial mode';

COMMENT ON COLUMN public.weekly_strategies.commercial_validation_score IS 
  'Commercial clarity score (0-5). Average of individual idea scores. Must be >= 3.5 to pass validation';

COMMENT ON COLUMN public.weekly_strategies.commercial_validation_details IS 
  'Detailed validation results: {idea_scores: [{idea_id: 1, score: 4, intent: "booking"}], quota_met: true, clarity_breakdown: {...}}';

COMMENT ON COLUMN public.weekly_strategies.commercial_validation_passed IS 
  'Did this strategy pass commercial validation? NULL if not yet validated, true/false after validation';

COMMENT ON COLUMN public.weekly_strategies.commercial_override_reason IS 
  'If validation failed but strategy was accepted anyway, this field explains why (manual override only)';

-- Indexes for commercial mode queries
CREATE INDEX IF NOT EXISTS idx_weekly_strategies_commercial_mode 
  ON public.weekly_strategies(business_id, commercial_mode);

CREATE INDEX IF NOT EXISTS idx_weekly_strategies_validation 
  ON public.weekly_strategies(commercial_validation_passed) 
  WHERE commercial_validation_passed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_strategies_triggered_by 
  ON public.weekly_strategies USING GIN (triggered_by);

-- =====================================================
-- PART 3: Post Idea Commercial Metadata Extension
-- =====================================================
-- Extend post_ideas JSONB structure to include required commercial fields
-- (This is schema documentation since post_ideas is JSONB - enforcement in application layer)

-- Expected post_ideas structure after this migration:
-- [
--   {
--     "idea_id": 1,
--     "title": "...",
--     "concept": "...",
--     "commercial_intent": "booking" | "footfall" | "brand" | "loyalty",
--     "cta_type": "reserve_table" | "visit_today" | "check_menu" | "join_community",
--     "timing_window": "today" | "this_week" | "this_weekend" | "ongoing",
--     "conversion_hook": "One-sentence reason to act now",
--     "expected_outcome": "table_reservation" | "walk_in_visit" | "brand_awareness" | "customer_retention",
--     "commercial_clarity_score": 1-5
--   }
-- ]

COMMENT ON COLUMN public.weekly_strategies.post_ideas IS 
  'Array of 7 PostIdea objects. Each must include: idea_id, title, concept, commercial_intent, cta_type, timing_window, conversion_hook, expected_outcome, commercial_clarity_score';

-- =====================================================
-- PART 4: Master Trigger Catalog (Reference Table)
-- =====================================================
-- System-wide trigger definitions that businesses can enable/configure

CREATE TABLE IF NOT EXISTS public.trigger_catalog (
  trigger_id TEXT PRIMARY KEY,
  trigger_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('event', 'temporal', 'seasonal', 'contextual')),
  description TEXT NOT NULL,
  default_applicability TEXT[], -- Business archetypes this typically applies to
  default_mode TEXT CHECK (default_mode IN ('booking_push', 'footfall_push', 'balanced', 'context_dependent')),
  default_min_booking INTEGER DEFAULT 0,
  default_min_footfall INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  system_priority INTEGER DEFAULT 50, -- Higher = more important when multiple triggers compete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.trigger_catalog IS 
  'Master catalog of available triggers. Businesses configure which triggers to enable in business_brand_profile.trigger_configuration';

-- Insert default triggers
INSERT INTO public.trigger_catalog (trigger_id, trigger_name, category, description, default_applicability, default_mode, default_min_booking, default_min_footfall, system_priority) VALUES
  ('VD_WEEK', 'Valentine''s Week', 'event', 'Week of February 12-14. High reservation intent for romantic dining.', 
   ARRAY['restaurant', 'bar', 'fine_dining'], 'booking_push', 3, 1, 90),
  
  ('MD_WEEK', 'Mother''s Day Week', 'event', 'Week before Mother''s Day. Family gathering and celebration focus.', 
   ARRAY['restaurant', 'café', 'brunch'], 'booking_push', 3, 1, 85),
  
  ('FD_WEEK', 'Father''s Day Week', 'event', 'Week before Father''s Day. Family celebration focus.', 
   ARRAY['restaurant', 'bar', 'steakhouse'], 'booking_push', 2, 2, 80),
  
  ('FIRST_WEEKEND', 'First Weekend of Month', 'temporal', 'First Friday-Sunday of each month. Fresh month discretionary spending.', 
   ARRAY['restaurant', 'café', 'bar', 'retail'], 'footfall_push', 1, 4, 40),
  
  ('PAYDAY_PERIOD', 'Payday Window', 'temporal', 'Typical payday periods (15th and end of month). Increased spending capacity.', 
   ARRAY['restaurant', 'bar', 'retail', 'service'], 'footfall_push', 1, 4, 45),
  
  ('WEATHER_BREAK', 'First Warm Day', 'seasonal', 'First day above 20°C after winter. Strong outdoor activity signal.', 
   ARRAY['café_outdoor', 'ice_cream', 'waterfront', 'terrace'], 'footfall_push', 0, 5, 95),
  
  ('LOCAL_EVENT', 'High Commercial Event', 'contextual', 'Local calendar event with commercial_weight > 8.', 
   ARRAY['all'], 'context_dependent', 0, 0, 70),
  
  ('QUIET_WEEK', 'Low Activity Week', 'contextual', 'No competing signals or events. Baseline commercial mode.', 
   ARRAY['all'], 'balanced', 1, 2, 10)
ON CONFLICT (trigger_id) DO NOTHING;

-- Index for active triggers
CREATE INDEX IF NOT EXISTS idx_trigger_catalog_active 
  ON public.trigger_catalog(is_active) WHERE is_active = true;

-- =====================================================
-- PART 5: Validation and Health Checks
-- =====================================================

-- Function to validate trigger configuration schema
CREATE OR REPLACE FUNCTION validate_trigger_configuration(config JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  trigger_key TEXT;
  trigger_config JSONB;
BEGIN
  -- Null is valid (no configuration)
  IF config IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Must be object
  IF jsonb_typeof(config) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  -- Validate each trigger configuration
  FOR trigger_key, trigger_config IN SELECT * FROM jsonb_each(config)
  LOOP
    -- Check required fields
    IF NOT (
      trigger_config ? 'enabled' AND
      (trigger_config->>'enabled')::boolean IN (true, false)
    ) THEN
      RETURN FALSE;
    END IF;
    
    -- If enabled, check mode is valid
    IF (trigger_config->>'enabled')::boolean = true THEN
      IF NOT (
        trigger_config ? 'mode' AND
        trigger_config->>'mode' IN ('booking_push', 'footfall_push', 'balanced', 'context_dependent')
      ) THEN
        RETURN FALSE;
      END IF;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_trigger_configuration IS 
  'Validates business trigger configuration JSON structure. Returns true if valid or NULL, false if invalid.';

-- Add constraint to business_brand_profile
ALTER TABLE public.business_brand_profile
  ADD CONSTRAINT valid_trigger_configuration 
  CHECK (validate_trigger_configuration(trigger_configuration));

-- =====================================================
-- PART 6: Helper Views
-- =====================================================

-- View: Businesses with incomplete commercial configuration
CREATE OR REPLACE VIEW v_businesses_missing_commercial_config AS
SELECT 
  b.id,
  b.name,
  b.category,
  bbp.commercial_baseline_mode,
  CASE 
    WHEN bbp.trigger_configuration IS NULL THEN 'No trigger configuration'
    WHEN bbp.commercial_baseline_mode IS NULL THEN 'No baseline mode set'
    ELSE 'Configuration incomplete'
  END AS issue
FROM public.businesses b
JOIN public.business_brand_profile bbp ON b.id = bbp.business_id
WHERE 
  bbp.trigger_configuration IS NULL OR
  bbp.commercial_baseline_mode IS NULL;

COMMENT ON VIEW v_businesses_missing_commercial_config IS 
  'Identifies businesses that need commercial mode configuration setup';

-- View: Weekly strategies failing commercial validation
CREATE OR REPLACE VIEW v_strategies_failing_validation AS
SELECT 
  ws.id,
  ws.business_id,
  b.name AS business_name,
  ws.week_start,
  ws.commercial_mode,
  ws.commercial_validation_score,
  ws.commercial_validation_passed,
  ws.commercial_validation_details,
  ws.generated_at
FROM public.weekly_strategies ws
JOIN public.businesses b ON ws.business_id = b.id
WHERE 
  ws.commercial_validation_passed = false
ORDER BY ws.generated_at DESC;

COMMENT ON VIEW v_strategies_failing_validation IS 
  'Tracks weekly strategies that failed commercial validation for quality monitoring';

-- =====================================================
-- PART 7: Migration Summary
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Commercial Mode System Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added to business_brand_profile:';
  RAISE NOTICE '  - trigger_configuration (JSONB)';
  RAISE NOTICE '  - commercial_baseline_mode (TEXT)';
  RAISE NOTICE '  - trigger_last_updated (TIMESTAMPTZ)';
  RAISE NOTICE '  - trigger_updated_by (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Added to weekly_strategies:';
  RAISE NOTICE '  - commercial_mode (TEXT)';
  RAISE NOTICE '  - commercial_mode_reason (TEXT)';
  RAISE NOTICE '  - triggered_by (TEXT[])';
  RAISE NOTICE '  - min_booking_ideas (INTEGER)';
  RAISE NOTICE '  - min_footfall_ideas (INTEGER)';
  RAISE NOTICE '  - commercial_validation_score (NUMERIC)';
  RAISE NOTICE '  - commercial_validation_details (JSONB)';
  RAISE NOTICE '  - commercial_validation_passed (BOOLEAN)';
  RAISE NOTICE '  - commercial_override_reason (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - trigger_catalog table with 8 default triggers';
  RAISE NOTICE '  - v_businesses_missing_commercial_config view';
  RAISE NOTICE '  - v_strategies_failing_validation view';
  RAISE NOTICE '  - validate_trigger_configuration() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run TypeScript type generation';
  RAISE NOTICE '  2. Implement commercial mode classifier';
  RAISE NOTICE '  3. Update prompt builders';
  RAISE NOTICE '  4. Add validation logic';
  RAISE NOTICE '  5. Create default configs for existing businesses';
  RAISE NOTICE '========================================';
END $$;
