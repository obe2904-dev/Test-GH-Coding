-- Add RPC to requeue stuck v2 jobs back to queued.
-- This is intentionally idempotent so it can be applied to an already-provisioned database.

CREATE OR REPLACE FUNCTION public.requeue_stale_menu_results_v2(max_age_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.menu_results_v2
  SET
    status = 'queued',
    claimed_at = NULL,
    -- Keep attempts as-is; it is incremented on the next successful claim
    extraction_method = COALESCE(extraction_method, 'stale_requeue')
  WHERE status = 'processing'
    AND claimed_at IS NOT NULL
    AND claimed_at < (now() - make_interval(mins => GREATEST(max_age_minutes, 1)));

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_stale_menu_results_v2(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_stale_menu_results_v2(integer) TO service_role;
