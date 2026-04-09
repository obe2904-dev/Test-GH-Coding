-- =====================================================
-- MIGRATION: Calendar commercial_weight + DK occasions
-- =====================================================
-- 1. Remove Store Bededag (abolished as DK public holiday in 2024)
-- 2. Add commercial_weight column (1–5) so Phase 1 can prioritise
--    high-value events over minor ones
-- 3. Backfill commercial_weight on existing DK rows
-- 4. Add missing DK commercial occasions
-- 5. Add lead_days column for events that need advance posting
-- =====================================================

-- ── 1. Remove Store Bededag (no longer a Danish public holiday) ──────────
DELETE FROM contextual_calendar
WHERE country = 'DK'
  AND event_name = 'Store Bededag';

-- ── 2. Add commercial_weight column ──────────────────────────────────────
-- 1 = minor awareness (info only)
-- 2 = low commercial relevance
-- 3 = moderate — worth one dedicated post
-- 4 = high — plan should revolve around this
-- 5 = critical — entire week shaped by this event (Christmas, Easter)
ALTER TABLE contextual_calendar
  ADD COLUMN IF NOT EXISTS commercial_weight SMALLINT NOT NULL DEFAULT 2
    CHECK (commercial_weight BETWEEN 1 AND 5);

-- Add recommended lead time (days before event to start posting)
ALTER TABLE contextual_calendar
  ADD COLUMN IF NOT EXISTS lead_days SMALLINT NOT NULL DEFAULT 3;

COMMENT ON COLUMN contextual_calendar.commercial_weight IS
  '1=minor, 2=low, 3=moderate, 4=high, 5=critical. Controls how aggressively Phase 1 allocates post capacity to this event.';
COMMENT ON COLUMN contextual_calendar.lead_days IS
  'Recommended days before event to start posting lead-up content. 0 = day-of only.';

-- ── 3. Backfill commercial_weight + lead_days on existing DK rows ─────────

-- Critical events (weight 5) — entire week built around these
UPDATE contextual_calendar SET commercial_weight = 5, lead_days = 7
WHERE country = 'DK' AND event_name IN (
  'Juleaftensdag', '1. Juledag', '2. Juledag',
  '1. Påskedag', '2. Påskedag', 'Langfredag', 'Skærtorsdag',
  'Juleferie', 'Påskeferie'
);

-- High events (weight 4) — plan should feature these prominently
UPDATE contextual_calendar SET commercial_weight = 4, lead_days = 5
WHERE country = 'DK' AND event_name IN (
  'Valentinsdag', 'Mors Dag',
  'Sommerferie', 'Shopping Season (Pre-Christmas)',
  'Nytårsdag'
);

-- Moderate events (weight 3) — worth at least one post
UPDATE contextual_calendar SET commercial_weight = 3, lead_days = 3
WHERE country = 'DK' AND event_name IN (
  'Fastelavn', 'Sankt Hans Aften', 'Vinterferie',
  'Efterårsferie (Uge 42)', 'Kristi Himmelfartsdag',
  '2. Pinsedag', 'Grundlovsdag', 'Fars Dag'
);

-- Low events (weight 2) — contextual awareness only
UPDATE contextual_calendar SET commercial_weight = 2, lead_days = 1
WHERE country = 'DK' AND event_name IN (
  'Outdoor Season Begin', 'Outdoor Season End',
  'Peak Outdoor Season', 'Dark Winter (Hygge)',
  'Black Friday', 'Weekend', 'Fredag Bar', 'Mandag Blues'
);

-- ── 4. Add missing DK commercial occasions (2026) ────────────────────────
-- Uses WHERE NOT EXISTS guards — safe to re-run.

DO $$
DECLARE
  ev RECORD;
BEGIN
  FOR ev IN (
    SELECT *
    FROM (VALUES
      -- Mortensaften — 10. november. Duck dinner tradition.
      -- One of the most commercially important nights of the year for Danish restaurants.
      ('DK'::text, 'cultural'::text,      'Mortensaften'::text,
       '2026-11-10'::date, NULL::date, 'annual'::text,
       ARRAY['families', 'couples', 'cozy_indoor']::text[],
       5::smallint, 5::smallint,
       'Emphasis: Duck dinner tradition — the biggest reservation night of the Danish restaurant year outside Christmas. Any restaurant NOT serving duck should acknowledge the tradition and offer their own comfort alternative.',
       'Promote: Andesteg menu, festive set menu, table reservations essential — start promoting 5–7 days ahead.'),

      -- Sankt Hans Aften — 23. juni. Midsummer bonfire evening.
      ('DK', 'cultural',                  'Sankt Hans Aften',
       '2026-06-23', NULL, 'annual',
       ARRAY['outdoor', 'families']::text[],
       3, 3,
       'Emphasis: Midsummer evening, Danish tradition, outdoor gatherings. People are in a festive outdoor mood.',
       'Promote: Summer evening menu, outdoor seating, light summer dishes, cold drinks.'),

      -- Halloween — 31. oktober. Growing commercial relevance in DK especially for families.
      ('DK', 'cultural',                  'Halloween',
       '2026-10-31', NULL, 'annual',
       ARRAY['families']::text[],
       2, 2,
       'Emphasis: Especially relevant for family-oriented venues. Adults/young guests enjoy themed events.',
       'Promote: Halloween-themed dishes or drinks, cozy autumn atmosphere, family-friendly events.'),

      -- Pinse (1. Pinsedag) — 24. maj. Whit Sunday — long weekend with outdoor weather.
      ('DK', 'holiday',                   '1. Pinsedag',
       '2026-05-24', NULL, 'annual',
       ARRAY['outdoor', 'families']::text[],
       3, 3,
       'Emphasis: Pentecost Sunday — start of a long weekend, often the first reliably warm outdoor weekend.',
       'Promote: Outdoor seating, spring menu, light lunches, terrace atmosphere.'),

      -- Nytårsaften — 31. december. New Year''s Eve dinner.
      ('DK', 'cultural',                  'Nytårsaften',
       '2026-12-31', NULL, 'annual',
       ARRAY['couples', 'families', 'cozy_indoor']::text[],
       5, 10,
       'Emphasis: New Year''s Eve — the one night where even casual restaurants fill up. Most guests book weeks in advance.',
       'Promote: New Year''s set menu, festive drinks, early bird reservation offer. Start promoting 10+ days ahead.'),

      -- Kvinder Kampdag / Internationale Kvindedags — 8. marts.
      ('DK', 'cultural',                  'Internationale Kvindedagens Dag',
       '2026-03-08', NULL, 'annual',
       ARRAY['couples', 'families']::text[],
       2, 2,
       'Emphasis: Relevant for venues with a strong female guest base or brunch culture.',
       'Promote: Brunch specials, celebrate the women in your life, social media congratulations.'),

      -- Juleaften (Julefrokost season) — the work Christmas lunch season runs through December.
      ('DK', 'cultural',                  'Julefrokost-sæsonen',
       '2026-11-27', '2026-12-18', 'annual',
       ARRAY['business', 'cozy_indoor']::text[],
       4, 7,
       'Emphasis: Danish work Christmas lunch (julefrokost) is a major seated event. Restaurants fill up weeks in advance for group bookings.',
       'Promote: Group dining packages, set julefrokost menu, available Fridays, advance booking required.'),

      -- Fastelavns søndag — the Sunday before Fastelavn Monday when kids hit barrels.
      -- (Fastelavn is already in the seed data as Monday — this adds Sunday for bakeries/cafés)
      ('DK', 'cultural',                  'Fastelavns Søndag',
       '2026-02-14', NULL, 'annual',
       ARRAY['families']::text[],
       2, 1,
       'Emphasis: Families are out with kids in costumes. Bakeries and cafés with fastelavnsboller are the focus.',
       'Promote: Fastelavnsboller, kids-welcome atmosphere, family Sunday brunch.'),

      -- Påskelørdag — Easter Saturday (between Good Friday and Easter Sunday)
      ('DK', 'cultural',                  'Påskelørdag',
       '2026-04-04', NULL, 'annual',
       ARRAY['families', 'cozy_indoor']::text[],
       3, 0,
       'Emphasis: Mid-Easter Saturday — families are home, some restaurants are open for brunch/lunch.',
       'Promote: Easter brunch, family-friendly, spring menu.'),

      -- Mors Dag — second Sunday in May 2026 = 10. maj
      ('DK', 'cultural',                  'Mors Dag',
       '2026-05-10', NULL, 'annual',
       ARRAY['families']::text[],
       4, 5,
       'Emphasis: Mother''s Day — one of the busiest brunch/lunch days of the year. Bookings fill up fast.',
       'Promote: Mother''s Day brunch, special menu, flowers on the table, book early — start promoting 5 days ahead.'),

      -- Fars Dag — first Sunday in June 2026 = 7. juni
      ('DK', 'cultural',                  'Fars Dag',
       '2026-06-07', NULL, 'annual',
       ARRAY['families']::text[],
       3, 4,
       'Emphasis: Father''s Day — busy Sunday lunch/dinner. Fathers often get to choose the restaurant.',
       'Promote: Father''s Day specials, BBQ, outdoor dining if weather allows, hearty menu for dads.')
    ) AS t(
      country, event_type, event_name,
      date_start, date_end, recurrence,
      relevance_tags,
      commercial_weight, lead_days,
      content_angle, marketing_hook
    )
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM contextual_calendar
      WHERE country    = ev.country
        AND event_type = ev.event_type
        AND event_name = ev.event_name
        AND date_start = ev.date_start
    ) THEN
      INSERT INTO contextual_calendar
        (country, event_type, event_name, date_start, date_end, recurrence,
         relevance_tags, commercial_weight, lead_days, content_angle, marketing_hook)
      VALUES
        (ev.country, ev.event_type, ev.event_name, ev.date_start, ev.date_end, ev.recurrence,
         ev.relevance_tags, ev.commercial_weight, ev.lead_days, ev.content_angle, ev.marketing_hook);
    END IF;
  END LOOP;
END $$;

-- ── 5. Update get_contextual_events() to return commercial_weight + lead_days ──
-- Must DROP first: PostgreSQL cannot change return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS get_contextual_events(TEXT, DATE, DATE, TEXT[]);
CREATE OR REPLACE FUNCTION get_contextual_events(
  p_country     TEXT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_tags        TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  event_type        TEXT,
  event_name        TEXT,
  date_start        DATE,
  date_end          DATE,
  relevance_tags    TEXT[],
  content_angle     TEXT,
  marketing_hook    TEXT,
  commercial_weight SMALLINT,
  lead_days         SMALLINT
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
    cc.marketing_hook,
    cc.commercial_weight,
    cc.lead_days
  FROM contextual_calendar cc
  WHERE
    cc.country = p_country
    AND (
      (cc.date_end IS NULL     AND cc.date_start BETWEEN p_start_date AND p_end_date)
      OR
      (cc.date_end IS NOT NULL AND cc.date_start <= p_end_date AND cc.date_end >= p_start_date)
    )
    AND (p_tags IS NULL OR cc.relevance_tags && p_tags)
  ORDER BY cc.commercial_weight DESC, cc.date_start, cc.event_type;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_contextual_events IS
  'Fetch contextual calendar events for a country and date range, ordered by commercial importance. Optionally filtered by relevance tags.';
