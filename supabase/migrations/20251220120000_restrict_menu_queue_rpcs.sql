-- Restrict queue/worker RPCs to service_role only.
-- These functions should never be callable from client-side keys.

BEGIN;

-- claim_menu_result_v2()
REVOKE ALL ON FUNCTION public.claim_menu_result_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_menu_result_v2() FROM anon;
REVOKE ALL ON FUNCTION public.claim_menu_result_v2() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_menu_result_v2() TO service_role;

-- requeue_stale_menu_results_v2(integer)
REVOKE ALL ON FUNCTION public.requeue_stale_menu_results_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_stale_menu_results_v2(integer) FROM anon;
REVOKE ALL ON FUNCTION public.requeue_stale_menu_results_v2(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_menu_results_v2(integer) TO service_role;

COMMIT;
