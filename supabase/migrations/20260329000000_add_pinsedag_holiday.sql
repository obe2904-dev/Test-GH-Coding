-- Add missing 1. Pinsedag (Pentecost Sunday) to DK holiday calendar.
-- 2026: Easter = 5. april → 1. Pinsedag = 49 days later = 24. maj.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM contextual_calendar
    WHERE country    = 'DK'
      AND event_type = 'holiday'
      AND event_name = '1. Pinsedag'
      AND date_start = '2026-05-24'
  ) THEN
    INSERT INTO contextual_calendar
      (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook, commercial_weight)
    VALUES
      ('DK', 'holiday', '1. Pinsedag', '2026-05-24', NULL, 'annual',
       ARRAY['outdoor', 'families'],
       'Emphasis: Pentecost Sunday, long weekend begins',
       'Promote: Spring menu, terrace dining, Pinsefrokost',
       2);
  END IF;
END $$;
