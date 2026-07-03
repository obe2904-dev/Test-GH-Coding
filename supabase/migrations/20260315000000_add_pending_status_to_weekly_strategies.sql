-- Add 'pending' and 'error' to weekly_strategies.status CHECK constraint
-- Needed for the async fire-and-respond pattern that fixes 504 timeouts:
--   1. Edge function immediately inserts status='pending' and returns HTTP 202
--   2. Full Gemini pipeline runs in EdgeRuntime.waitUntil() (background)
--   3. Row is updated to status='generated' when pipeline completes
--   4. Status 'error' is set if the background generation fails

-- Drop the existing inline check constraint (auto-named by Postgres)
ALTER TABLE public.weekly_strategies
  DROP CONSTRAINT IF EXISTS weekly_strategies_status_check;

-- Re-add with expanded value set
ALTER TABLE public.weekly_strategies
  ADD CONSTRAINT weekly_strategies_status_check
  CHECK (status IN ('pending', 'generated', 'ideas_selected', 'posts_created', 'error'));

-- Update column comment to reflect new lifecycle
COMMENT ON COLUMN public.weekly_strategies.status IS
  'Workflow status: pending (generation in progress) → generated (Layer 0 complete) → ideas_selected (user chose ideas) → posts_created (Layer 1-9 complete) | error (background generation failed)';
