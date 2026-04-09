-- Fix: Add missing 1. Påskedag (Easter Sunday) and ensure all DK 2026 calendar
-- events are present.
-- Uses WHERE NOT EXISTS guards because contextual_calendar has no UNIQUE
-- constraint on (country, event_name, date_start) — ON CONFLICT would not
-- prevent duplicates here.

-- Helper: insert only if no row with the same country+event_type+event_name+date_start exists.
DO $$
DECLARE
  events RECORD;
BEGIN
  FOR events IN (
    SELECT *
    FROM (VALUES
      ('DK'::text, 'holiday'::text,          'Nytårsdag'::text,             '2026-01-01'::date, NULL::date,         'annual'::text, ARRAY['cozy_indoor']::text[],                'Emphasis: Fresh start, new year energy',                        'Promote: New year brunch, healthy menu items'),
      ('DK',       'holiday',                 'Skærtorsdag',                 '2026-04-02',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Long weekend begins',                                 'Promote: Easter menu, family dining'),
      ('DK',       'holiday',                 'Langfredag',                  '2026-04-03',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Easter traditions',                                   'Promote: Traditional Danish Easter lunch'),
      ('DK',       'holiday',                 '1. Påskedag',                 '2026-04-05',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Easter Sunday, the main Easter celebration day',      'Promote: Easter Sunday brunch, special Easter menu, family dining'),
      ('DK',       'holiday',                 '2. Påskedag',                 '2026-04-06',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Family gatherings',                                   'Promote: Easter brunch, family-friendly atmosphere'),
      ('DK',       'holiday',                 'Kristi Himmelfartsdag',       '2026-05-14',        NULL,               'annual',       ARRAY['outdoor', 'families'],                'Emphasis: Often combined with weekend off',                     'Promote: Outdoor dining, day trips'),
      ('DK',       'holiday',                 '2. Pinsedag',                 '2026-05-25',        NULL,               'annual',       ARRAY['outdoor', 'families'],                'Emphasis: Pentecost weekend',                                   'Promote: Spring menu, terrace dining'),
      ('DK',       'holiday',                 'Grundlovsdag',                '2026-06-05',        NULL,               'annual',       ARRAY['outdoor'],                            'Emphasis: Constitution Day, patriotic',                         'Promote: Danish classics, outdoor events'),
      ('DK',       'holiday',                 'Juleaftensdag',               '2026-12-24',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Most places closed, family time',                     'Watch out: Respect that most are at home'),
      ('DK',       'holiday',                 '1. Juledag',                  '2026-12-25',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Christmas Day',                                       'Promote: Christmas brunch if open'),
      ('DK',       'holiday',                 '2. Juledag',                  '2026-12-26',        NULL,               'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Boxing Day, family gatherings',                       'Promote: Post-Christmas casual dining'),
      ('DK',       'school_vacation',         'Vinterferie',                 '2026-02-07',        '2026-02-15',       'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Family activities, kids at home',                     'Promote: Kids menu, family-friendly lunch, hot chocolate'),
      ('DK',       'school_vacation',         'Påskeferie',                  '2026-03-30',        '2026-04-06',       'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Easter break, family time',                           'Promote: Easter brunch, family dining, kids activities'),
      ('DK',       'school_vacation',         'Sommerferie',                 '2026-06-27',        '2026-08-10',       'annual',       ARRAY['families', 'outdoor'],                'Emphasis: Peak vacation season, tourism',                       'Promote: Outdoor dining, ice cream, refreshing drinks, tourist-friendly'),
      ('DK',       'school_vacation',         'Efterårsferie (Uge 42)',      '2026-10-10',        '2026-10-18',       'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Fall break, cozy indoor activities',                  'Promote: Warm comfort food, fall menu, family deals'),
      ('DK',       'school_vacation',         'Juleferie',                   '2026-12-21',        '2027-01-03',       'annual',       ARRAY['families', 'cozy_indoor'],            'Emphasis: Christmas break, holiday season',                     'Promote: Holiday specials, festive atmosphere, gift vouchers')
    ) AS t(country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook)
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM contextual_calendar
      WHERE country     = events.country
        AND event_type  = events.event_type
        AND event_name  = events.event_name
        AND date_start  = events.date_start
    ) THEN
      INSERT INTO contextual_calendar
        (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook)
      VALUES
        (events.country, events.event_type, events.event_name, events.date_start, events.date_end,
         events.recurrence, events.relevance_tags, events.content_angle, events.marketing_hook);
    END IF;
  END LOOP;
END $$;

