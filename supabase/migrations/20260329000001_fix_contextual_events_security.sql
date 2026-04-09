-- =====================================================
-- FIX: Make get_contextual_events SECURITY DEFINER
-- =====================================================
-- The function was SECURITY INVOKER (default), causing
-- RLS on contextual_calendar to silently return 0 rows
-- when called via the anon/authenticated JWT from the
-- PostgREST layer, even with the service role client.
-- SECURITY DEFINER runs with the function owner's
-- privileges, bypassing RLS entirely.
-- =====================================================

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
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

COMMENT ON FUNCTION get_contextual_events IS
  'Fetch contextual calendar events for a country and date range, ordered by commercial importance. SECURITY DEFINER to bypass RLS on contextual_calendar.';

-- Reload PostgREST schema cache so it picks up the new function signature
NOTIFY pgrst, 'reload schema';
