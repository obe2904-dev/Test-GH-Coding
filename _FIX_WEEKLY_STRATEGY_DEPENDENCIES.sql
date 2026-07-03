-- =====================================================
-- FIX ALL MISSING TABLES AND COLUMNS FOR WEEKLY STRATEGY
-- =====================================================
-- Combines 5 migrations that were never deployed:
-- 1. weekly_strategies.strategy_version column
-- 2. contextual_calendar table
-- 3. weekly_content_plans table
-- 4. businesses.category column
-- 5. business_brand_profile.brand_essence_elaboration column
-- =====================================================

-- =====================================================
-- 1. ADD STRATEGY_VERSION TO weekly_strategies
-- =====================================================
-- From migration: 20260212000000_add_strategic_brief_storage.sql
ALTER TABLE public.weekly_strategies
ADD COLUMN IF NOT EXISTS strategy_version TEXT DEFAULT 'v2_two_phase';

COMMENT ON COLUMN public.weekly_strategies.strategy_version IS 
'Strategy generation version/architecture. Used to separate analytics across major changes.
- v1_single_phase: Original single-pass generation
- v2_two_phase: Current architecture (Phase 1 strategic brief → Phase 2 content plan)
- v2.1_brand_v5: V5 brand profile integration';

CREATE INDEX IF NOT EXISTS idx_weekly_strategies_version
ON public.weekly_strategies(business_id, strategy_version);

-- =====================================================
-- 2. CREATE contextual_calendar TABLE
-- =====================================================
-- From migration: 20260127100000_create_contextual_calendar.sql
CREATE TABLE IF NOT EXISTS contextual_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Geographic scope
  country TEXT NOT NULL,
  region TEXT,
  
  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'holiday',
    'school_vacation',
    'season',
    'cultural',
    'business_rhythm'
  )),
  
  event_name TEXT NOT NULL,
  
  -- Timing
  date_start DATE NOT NULL,
  date_end DATE,
  
  -- Recurrence pattern
  recurrence TEXT CHECK (recurrence IN ('annual', 'seasonal', 'monthly', 'weekly', NULL)),
  recurrence_rule TEXT,
  
  -- Relevance filtering
  relevance_tags TEXT[],
  
  -- AI content guidance
  content_angle TEXT,
  marketing_hook TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contextual_calendar_country ON contextual_calendar(country);
CREATE INDEX IF NOT EXISTS idx_contextual_calendar_dates ON contextual_calendar(date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_contextual_calendar_type ON contextual_calendar(event_type);
CREATE INDEX IF NOT EXISTS idx_contextual_calendar_tags ON contextual_calendar USING GIN(relevance_tags);

COMMENT ON TABLE contextual_calendar IS 'Country-specific calendar events for AI content suggestions';

-- Seed data for Denmark 2026
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'holiday', 'Nytårsdag', '2026-01-01', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Fresh start, new year energy', 'Promote: New year brunch, healthy menu items'),
  ('DK', 'holiday', 'Skærtorsdag', '2026-04-02', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Long weekend begins', 'Promote: Easter menu, family dining'),
  ('DK', 'holiday', 'Langfredag', '2026-04-03', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter traditions', 'Promote: Traditional Danish Easter lunch'),
  ('DK', 'holiday', '1. Påskedag', '2026-04-05', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter Sunday', 'Promote: Easter Sunday brunch, special Easter menu'),
  ('DK', 'holiday', '2. Påskedag', '2026-04-06', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Family gatherings', 'Promote: Easter brunch, family-friendly'),
  ('DK', 'holiday', 'Kristi Himmelfartsdag', '2026-05-14', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Often combined with weekend off', 'Promote: Outdoor dining'),
  ('DK', 'holiday', '2. Pinsedag', '2026-05-25', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Pentecost weekend', 'Promote: Spring menu, terrace'),
  ('DK', 'holiday', 'Grundlovsdag', '2026-06-05', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: Constitution Day', 'Promote: Danish classics'),
  ('DK', 'school_vacation', 'Sommerferie', '2026-06-27', '2026-08-10', 'annual', ARRAY['families', 'outdoor'], 'Emphasis: Peak vacation season', 'Promote: Outdoor dining, refreshing drinks')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. CREATE weekly_content_plans TABLE
-- =====================================================
-- From archive: ADD_WEEKLY_CONTENT_PLANS_TABLES.sql
CREATE TABLE IF NOT EXISTS weekly_content_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Post specifications
  posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  learning_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_content_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_business ON weekly_content_plans(business_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week_start ON weekly_content_plans(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week ON weekly_content_plans(user_id, week_start);

COMMENT ON TABLE weekly_content_plans IS 'Stores AI-generated weekly content plans with 4-7 post specifications';

-- Enable RLS
ALTER TABLE weekly_content_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can view their own weekly plans" 
  ON weekly_content_plans FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can create their own weekly plans" 
  ON weekly_content_plans FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can update their own weekly plans" 
  ON weekly_content_plans FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can delete their own weekly plans" 
  ON weekly_content_plans FOR DELETE 
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. ADD CATEGORY TO businesses
-- =====================================================
-- From archive: ADD_BUSINESS_CATEGORY_COLUMN.sql
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.businesses.category IS 'Specific business type (e.g., café, restaurant, bar) - used for AI context';

-- For existing businesses, copy vertical to category as starting point
UPDATE public.businesses
SET category = vertical
WHERE category IS NULL AND vertical IS NOT NULL;

-- =====================================================
-- 5. ADD BRAND ESSENCE TO business_brand_profile
-- =====================================================
-- From migration: 20260430000000_add_brand_elaboration_fields.sql
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS business_character TEXT,
ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT;

COMMENT ON COLUMN business_brand_profile.business_character IS 'AI-generated description of what the business is (prevents hallucination)';
COMMENT ON COLUMN business_brand_profile.brand_essence_elaboration IS 'Deterministically-built 2-3 sentence strategic anchor (location, offerings, audience)';

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'weekly_strategies.strategy_version' as fix, 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END as status
FROM information_schema.columns 
WHERE table_name = 'weekly_strategies' AND column_name = 'strategy_version'
UNION ALL
SELECT 'contextual_calendar table', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Table created' ELSE '❌ Failed' END
FROM information_schema.tables 
WHERE table_name = 'contextual_calendar'
UNION ALL
SELECT 'weekly_content_plans table', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Table created' ELSE '❌ Failed' END
FROM information_schema.tables 
WHERE table_name = 'weekly_content_plans'
UNION ALL
SELECT 'businesses.category', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END
FROM information_schema.columns 
WHERE table_name = 'businesses' AND column_name = 'category'
UNION ALL
SELECT 'brand_essence_elaboration', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' AND column_name = 'brand_essence_elaboration';
