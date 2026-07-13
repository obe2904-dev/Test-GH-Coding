-- ═══════════════════════════════════════════════════════════════════════════
-- Calendar System: Public Holidays & Local Events
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: May 9, 2026
-- Purpose: Enable context-aware weekly planning based on holidays and events
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- Table 1: Public Holidays
-- ────────────────────────────────────────────────────────────────────────────
-- Stores official public holidays for each country we serve
-- Populated via JSON import script, maintained annually

CREATE TABLE IF NOT EXISTS calendar_public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL CHECK (country IN ('Denmark', 'Sweden', 'Germany')),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  name_local TEXT, -- e.g., "Kristi Himmelfartsdag" (Danish)
  is_public_holiday BOOLEAN DEFAULT true,
  retail_impact TEXT CHECK (retail_impact IN ('stores_closed', 'reduced_hours', 'normal')),
  typical_bridge_day BOOLEAN DEFAULT false, -- true if next day commonly taken as vacation
  hospitality_traffic TEXT CHECK (hospitality_traffic IN ('high', 'medium', 'normal')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, date)
);

CREATE INDEX idx_public_holidays_lookup ON calendar_public_holidays(country, date);
CREATE INDEX idx_public_holidays_date_range ON calendar_public_holidays(date) WHERE is_public_holiday = true;

COMMENT ON TABLE calendar_public_holidays IS 'Official public holidays by country for weekly planning context';
COMMENT ON COLUMN calendar_public_holidays.retail_impact IS 'Impact on retail stores: stores_closed = major footfall shift to cafés/restaurants';
COMMENT ON COLUMN calendar_public_holidays.typical_bridge_day IS 'True if following day is commonly taken as vacation (e.g., Thu holiday → Fri bridge day)';

-- ────────────────────────────────────────────────────────────────────────────
-- Table 2: Recurring Local Events
-- ────────────────────────────────────────────────────────────────────────────
-- Major recurring events that impact specific cities (festivals, etc.)
-- Manually maintained, ~30 entries total for all cities combined

CREATE TABLE IF NOT EXISTS calendar_local_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL CHECK (country IN ('Denmark', 'Sweden', 'Germany')),
  city TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('festival', 'sports', 'cultural', 'commercial', 'religious', 'other')),
  typical_timing TEXT, -- e.g., "Last full week of August", "First weekend in June"
  start_date DATE, -- Specific date if known for current year
  end_date DATE,
  audience_type TEXT, -- e.g., "Tourists + locals", "Families", "Young adults"
  traffic_impact TEXT CHECK (traffic_impact IN ('high', 'medium', 'low')),
  business_types TEXT[], -- ['cafe', 'restaurant', 'bar'] = high relevance
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, city, event_name)
);

CREATE INDEX idx_local_events_city ON calendar_local_events(country, city);
CREATE INDEX idx_local_events_dates ON calendar_local_events(start_date, end_date) WHERE start_date IS NOT NULL;

COMMENT ON TABLE calendar_local_events IS 'Major recurring local events (Aarhus Festuge, etc.) for weekly planning context';
COMMENT ON COLUMN calendar_local_events.typical_timing IS 'Human-readable pattern for recurring events';
COMMENT ON COLUMN calendar_local_events.business_types IS 'Array of business types most impacted by this event';

-- ────────────────────────────────────────────────────────────────────────────
-- Helper Function: Get Week Calendar Context
-- ────────────────────────────────────────────────────────────────────────────
-- Returns holidays and events for a given week

CREATE OR REPLACE FUNCTION get_week_calendar_context(
  p_country TEXT,
  p_city TEXT,
  p_week_start DATE,
  p_week_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'holidays', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', date,
          'name', name,
          'name_local', name_local,
          'retail_impact', retail_impact,
          'typical_bridge_day', typical_bridge_day,
          'hospitality_traffic', hospitality_traffic,
          'notes', notes
        )
      ), '[]'::json)
      FROM calendar_public_holidays
      WHERE country = p_country
        AND date BETWEEN p_week_start AND p_week_end
        AND is_public_holiday = true
    ),
    'local_events', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'event_name', event_name,
          'event_type', event_type,
          'start_date', start_date,
          'end_date', end_date,
          'audience_type', audience_type,
          'traffic_impact', traffic_impact,
          'description', description
        )
      ), '[]'::json)
      FROM calendar_local_events
      WHERE country = p_country
        AND city = p_city
        AND (
          (start_date IS NOT NULL AND end_date IS NOT NULL AND 
           (start_date BETWEEN p_week_start AND p_week_end OR 
            end_date BETWEEN p_week_start AND p_week_end OR
            (start_date <= p_week_start AND end_date >= p_week_end)))
        )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_week_calendar_context IS 'Returns holidays and local events for a specific week and location';

-- ────────────────────────────────────────────────────────────────────────────
-- Sample Data: Denmark 2026 Major Holidays
-- ────────────────────────────────────────────────────────────────────────────
-- Initial seed data - full import via JSON script

INSERT INTO calendar_public_holidays (country, date, name, name_local, retail_impact, typical_bridge_day, hospitality_traffic, notes)
VALUES
  ('Denmark', '2026-05-01', 'International Workers'' Day', 'Arbejdernes kampdag', 'stores_closed', false, 'medium', 'Store Saturday - reduced retail hours'),
  ('Denmark', '2026-05-14', 'Ascension Day', 'Kristi Himmelfartsdag', 'stores_closed', true, 'high', 'Thursday holiday - most take Friday as bridge day'),
  ('Denmark', '2026-05-24', 'Whit Sunday', '2. Pinsedag', 'stores_closed', false, 'medium', 'Extended Pentecost weekend'),
  ('Denmark', '2026-05-25', 'Whit Monday', '2. Pinsedag', 'stores_closed', false, 'medium', 'Part of Pentecost weekend'),
  ('Denmark', '2026-06-05', 'Constitution Day', 'Grundlovsdag', 'reduced_hours', false, 'medium', 'Afternoon holiday - shops close early'),
  ('Denmark', '2026-12-24', 'Christmas Eve', 'Juleaften', 'stores_closed', false, 'low', 'Most businesses closed'),
  ('Denmark', '2026-12-25', 'Christmas Day', '1. Juledag', 'stores_closed', false, 'low', 'Everything closed'),
  ('Denmark', '2026-12-26', 'Boxing Day', '2. Juledag', 'stores_closed', false, 'low', 'Everything closed')
ON CONFLICT (country, date) DO UPDATE SET
  name = EXCLUDED.name,
  name_local = EXCLUDED.name_local,
  retail_impact = EXCLUDED.retail_impact,
  typical_bridge_day = EXCLUDED.typical_bridge_day,
  hospitality_traffic = EXCLUDED.hospitality_traffic,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Sample local event
INSERT INTO calendar_local_events (country, city, event_name, event_type, typical_timing, audience_type, traffic_impact, business_types, description)
VALUES
  ('Denmark', 'Aarhus', 'Aarhus Festuge', 'festival', 'Last full week of August', 'Tourists + locals', 'high', ARRAY['cafe', 'restaurant', 'bar'], 'Major cultural festival with +40% tourist traffic')
ON CONFLICT (country, city, event_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- Grant Permissions
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE calendar_public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_local_events ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required for calendar lookups)
CREATE POLICY "Public holidays are publicly readable" ON calendar_public_holidays FOR SELECT USING (true);
CREATE POLICY "Local events are publicly readable" ON calendar_local_events FOR SELECT USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage holidays" ON calendar_public_holidays FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role can manage events" ON calendar_local_events FOR ALL USING (auth.jwt()->>'role' = 'service_role');
