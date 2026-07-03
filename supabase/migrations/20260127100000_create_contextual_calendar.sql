-- =====================================================
-- CONTEXTUAL CALENDAR SYSTEM
-- =====================================================
-- Stores country-specific events, holidays, vacations, and seasonal context
-- Used by AI to generate timely, relevant content suggestions

CREATE TABLE IF NOT EXISTS contextual_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Geographic scope
  country TEXT NOT NULL, -- ISO 3166-1 alpha-2: 'DK', 'SE', 'NO', 'DE', 'IT', etc.
  region TEXT, -- Optional: 'Region Hovedstaden', 'Skåne', 'Nordland', etc.
  
  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'holiday',          -- Public holidays (Easter, Christmas, etc.)
    'school_vacation',  -- School breaks (summer, winter, spring)
    'season',           -- Seasonal periods (outdoor season, shopping season)
    'cultural',         -- Cultural events (Valentine's, Mother's Day)
    'business_rhythm'   -- Weekly/monthly patterns (weekend, payday)
  )),
  
  event_name TEXT NOT NULL, -- Human-readable name
  
  -- Timing
  date_start DATE NOT NULL,
  date_end DATE, -- NULL for single-day events
  
  -- Recurrence pattern
  recurrence TEXT CHECK (recurrence IN ('annual', 'seasonal', 'monthly', 'weekly', NULL)),
  recurrence_rule TEXT, -- Optional: "First Monday of June", "Week 7-10", etc.
  
  -- Relevance filtering
  relevance_tags TEXT[], -- ['families', 'couples', 'outdoor', 'shopping', 'cozy_indoor', 'romantic', 'sports', 'business']
  
  -- AI content guidance
  content_angle TEXT, -- "Emphasis: Family-friendly posts, watch out: Don't assume everyone is celebrating"
  marketing_hook TEXT, -- "Perfect time to promote: brunch specials, kids menu, outdoor seating"
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_contextual_calendar_country ON contextual_calendar(country);
CREATE INDEX idx_contextual_calendar_dates ON contextual_calendar(date_start, date_end);
CREATE INDEX idx_contextual_calendar_type ON contextual_calendar(event_type);
CREATE INDEX idx_contextual_calendar_tags ON contextual_calendar USING GIN(relevance_tags);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_contextual_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contextual_calendar_updated_at
  BEFORE UPDATE ON contextual_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_contextual_calendar_updated_at();

-- Comments
COMMENT ON TABLE contextual_calendar IS 'Country-specific calendar events for AI content suggestions';
COMMENT ON COLUMN contextual_calendar.country IS 'ISO 3166-1 alpha-2 country code (DK, SE, NO, etc.)';
COMMENT ON COLUMN contextual_calendar.region IS 'Optional regional subdivision for events that vary by area';
COMMENT ON COLUMN contextual_calendar.relevance_tags IS 'Filter events by business concept fit (families, couples, outdoor, etc.)';
COMMENT ON COLUMN contextual_calendar.content_angle IS 'AI guidance for content strategy during this period';
COMMENT ON COLUMN contextual_calendar.marketing_hook IS 'Specific promotional opportunities to highlight';


-- =====================================================
-- SEED DATA: DENMARK (DK)
-- =====================================================

-- Public Holidays 2026
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'holiday', 'Nytårsdag', '2026-01-01', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Fresh start, new year energy', 'Promote: New year brunch, healthy menu items'),
  ('DK', 'holiday', 'Skærtorsdag', '2026-04-02', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Long weekend begins', 'Promote: Easter menu, family dining'),
  ('DK', 'holiday', 'Langfredag', '2026-04-03', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter traditions', 'Promote: Traditional Danish Easter lunch'),
  ('DK', 'holiday', '1. Påskedag', '2026-04-05', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter Sunday, the main Easter celebration day', 'Promote: Easter Sunday brunch, special Easter menu, family dining'),
  ('DK', 'holiday', '2. Påskedag', '2026-04-06', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Family gatherings', 'Promote: Easter brunch, family-friendly atmosphere'),
  ('DK', 'holiday', 'Kristi Himmelfartsdag', '2026-05-14', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Often combined with weekend off', 'Promote: Outdoor dining, day trips'),
  ('DK', 'holiday', '2. Pinsedag', '2026-05-25', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Pentecost weekend', 'Promote: Spring menu, terrace dining'),
  ('DK', 'holiday', 'Grundlovsdag', '2026-06-05', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: Constitution Day, patriotic', 'Promote: Danish classics, outdoor events'),
  ('DK', 'holiday', 'Juleaftensdag', '2026-12-24', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Most places closed, family time', 'Watch out: Respect that most are at home'),
  ('DK', 'holiday', '1. Juledag', '2026-12-25', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Christmas Day', 'Promote: Christmas brunch if open'),
  ('DK', 'holiday', '2. Juledag', '2026-12-26', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Boxing Day, family gatherings', 'Promote: Post-Christmas casual dining');

-- School Vacations 2026 (Denmark-wide)
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'school_vacation', 'Vinterferie', '2026-02-07', '2026-02-15', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Family activities, kids at home', 'Promote: Kids menu, family-friendly lunch, hot chocolate'),
  ('DK', 'school_vacation', 'Påskeferie', '2026-03-30', '2026-04-06', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter break, family time', 'Promote: Easter brunch, family dining, kids activities'),
  ('DK', 'school_vacation', 'Sommerferie', '2026-06-27', '2026-08-10', 'annual', ARRAY['families', 'outdoor'], 'Emphasis: Peak vacation season, tourism', 'Promote: Outdoor dining, ice cream, refreshing drinks, tourist-friendly'),
  ('DK', 'school_vacation', 'Efterårsferie (Uge 42)', '2026-10-10', '2026-10-18', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Fall break, cozy indoor activities', 'Promote: Warm comfort food, fall menu, family deals'),
  ('DK', 'school_vacation', 'Juleferie', '2026-12-21', '2027-01-03', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Christmas break, holiday season', 'Promote: Holiday specials, festive atmosphere, gift vouchers');

-- Seasonal Periods
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'season', 'Outdoor Season Begin', '2026-05-01', '2026-05-31', 'annual', ARRAY['outdoor'], 'Emphasis: First warm days, outdoor enthusiasm', 'Promote: Terrace opening, outdoor seating, al fresco dining'),
  ('DK', 'season', 'Peak Outdoor Season', '2026-06-01', '2026-08-31', 'annual', ARRAY['outdoor'], 'Emphasis: Summer dining, long evenings', 'Promote: Outdoor events, cold drinks, evening dining'),
  ('DK', 'season', 'Outdoor Season End', '2026-09-01', '2026-09-30', 'annual', ARRAY['outdoor', 'cozy_indoor'], 'Emphasis: Last warm days, transition to indoor', 'Promote: Late summer terrace, cozy indoor atmosphere'),
  ('DK', 'season', 'Shopping Season (Pre-Christmas)', '2026-11-15', '2026-12-23', 'annual', ARRAY['shopping', 'business'], 'Emphasis: Christmas shopping, gift buying, stressed shoppers', 'Promote: Quick lunch, takeaway coffee, gift vouchers, relaxation breaks'),
  ('DK', 'season', 'Dark Winter (Hygge)', '2026-11-01', '2027-02-28', 'annual', ARRAY['cozy_indoor'], 'Emphasis: Dark evenings, hygge culture, comfort', 'Promote: Cozy atmosphere, candlelight, warm drinks, comfort food');

-- Cultural Events
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'cultural', 'Valentinsdag', '2026-02-14', NULL, 'annual', ARRAY['couples', 'romantic'], 'Emphasis: Romantic dining, couples-oriented', 'Promote: Romantic dinner menu, couples specials, intimate atmosphere'),
  ('DK', 'cultural', 'Fastelavn', '2026-02-15', NULL, 'annual', ARRAY['families'], 'Emphasis: Danish carnival tradition, kids', 'Promote: Fastelavnsboller, family-friendly, costume fun'),
  ('DK', 'cultural', 'Mors Dag', '2026-05-10', NULL, 'annual', ARRAY['families'], 'Emphasis: Celebrating mothers, family gatherings', 'Promote: Mother''s Day brunch, family dining, flowers/gifts'),
  ('DK', 'cultural', 'Fars Dag', '2026-06-05', NULL, 'annual', ARRAY['families'], 'Emphasis: Father''s Day (same as Grundlovsdag)', 'Promote: Father''s Day specials, BBQ, outdoor dining'),
  ('DK', 'cultural', 'Sankt Hans Aften', '2026-06-23', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Midsummer celebrations, bonfires', 'Promote: Summer evening dining, outdoor atmosphere, Danish traditions'),
  ('DK', 'cultural', 'Black Friday', '2026-11-27', NULL, 'annual', ARRAY['shopping', 'business'], 'Emphasis: Shopping frenzy, deals', 'Promote: Special offers, coffee breaks for tired shoppers, quick meals');

-- Business Rhythms (Weekly patterns)
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, recurrence_rule, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'business_rhythm', 'Weekend', '2026-01-03', '2026-01-04', 'weekly', 'Every Saturday-Sunday', ARRAY['families', 'couples'], 'Emphasis: Relaxed pace, leisure time, brunch culture', 'Promote: Brunch menu, longer dining times, family gatherings'),
  ('DK', 'business_rhythm', 'Fredag Bar', '2026-01-02', NULL, 'weekly', 'Every Friday', ARRAY['business', 'couples'], 'Emphasis: End-of-week relaxation, after-work drinks', 'Promote: Happy hour, bar menu, social atmosphere'),
  ('DK', 'business_rhythm', 'Mandag Blues', '2026-01-05', NULL, 'weekly', 'Every Monday', ARRAY['business'], 'Emphasis: Back to work, need comfort', 'Promote: Comfort food, quick lunch, energizing coffee');


-- =====================================================
-- HELPER FUNCTION: Get events for date range
-- =====================================================
CREATE OR REPLACE FUNCTION get_contextual_events(
  p_country TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  event_type TEXT,
  event_name TEXT,
  date_start DATE,
  date_end DATE,
  relevance_tags TEXT[],
  content_angle TEXT,
  marketing_hook TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.event_type,
    cc.event_name,
    cc.date_start,
    cc.date_end,
    cc.relevance_tags,
    cc.content_angle,
    cc.marketing_hook
  FROM contextual_calendar cc
  WHERE 
    cc.country = p_country
    AND (
      -- Single-day events
      (cc.date_end IS NULL AND cc.date_start BETWEEN p_start_date AND p_end_date)
      OR
      -- Multi-day events (overlap with query range)
      (cc.date_end IS NOT NULL AND cc.date_start <= p_end_date AND cc.date_end >= p_start_date)
    )
    -- Optional tag filtering
    AND (p_tags IS NULL OR cc.relevance_tags && p_tags)
  ORDER BY cc.date_start, cc.event_type;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_contextual_events IS 'Fetch contextual calendar events for a country and date range, optionally filtered by relevance tags';
