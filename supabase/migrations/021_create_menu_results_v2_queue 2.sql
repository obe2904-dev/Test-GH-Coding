-- Create a clean v2 menu extraction queue (isolated from legacy menu_results)

CREATE TABLE IF NOT EXISTS public.menu_results_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Source metadata
  source_kind text NOT NULL DEFAULT 'url', -- url | storage
  source_url text,
  source_content_type text,
  storage_bucket text,
  storage_path text,
  sha256 text,

  -- Processing
  status text NOT NULL DEFAULT 'queued', -- queued | processing | done | error
  language_code text DEFAULT 'da',
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamp with time zone,
  completed_at timestamp with time zone,
  extraction_method text,

  -- Results
  raw_text text,
  structured_data jsonb,
  error_message text,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT menu_results_v2_source_kind_check CHECK (source_kind IN ('url', 'storage')),
  CONSTRAINT menu_results_v2_status_check CHECK (status IN ('queued', 'processing', 'done', 'error')),
  CONSTRAINT menu_results_v2_storage_ref_check CHECK (
    source_kind <> 'storage' OR (storage_bucket IS NOT NULL AND storage_path IS NOT NULL)
  )
);

-- Additional constraint (idempotent): url jobs must include a source_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'menu_results_v2_url_ref_check'
  ) THEN
    ALTER TABLE public.menu_results_v2
      ADD CONSTRAINT menu_results_v2_url_ref_check
      CHECK (source_kind <> 'url' OR source_url IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_menu_results_v2_status_created_at ON public.menu_results_v2(status, created_at);
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_business_status ON public.menu_results_v2(business_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_claimed_at ON public.menu_results_v2(claimed_at);
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_sha ON public.menu_results_v2(sha256);

-- Realtime publication membership (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'menu_results_v2'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_results_v2;
  END IF;
END
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_menu_results_v2_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS menu_results_v2_updated_at ON public.menu_results_v2;
CREATE TRIGGER menu_results_v2_updated_at
  BEFORE UPDATE ON public.menu_results_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_menu_results_v2_updated_at();

-- Atomic claim function for v2
CREATE OR REPLACE FUNCTION public.claim_menu_result_v2()
RETURNS public.menu_results_v2
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.menu_results_v2;
BEGIN
  WITH next_job AS (
    SELECT id
    FROM public.menu_results_v2
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.menu_results_v2 mr
  SET
    status = 'processing',
    claimed_at = now(),
    attempts = mr.attempts + 1
  WHERE mr.id IN (SELECT id FROM next_job)
  RETURNING mr.* INTO claimed;

  RETURN claimed;
END;
$$;

-- Requeue stale jobs (e.g. worker crash while processing)
-- Sets stuck jobs back to queued so a worker can retry.
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

-- RLS: users should only be able to see jobs for businesses they can access.
ALTER TABLE public.menu_results_v2 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menu_results_v2'
      AND policyname = 'Users can view their business menu results v2'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view their business menu results v2"
        ON public.menu_results_v2
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = menu_results_v2.business_id
              AND (
                b.owner_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM public.business_team_members btm
                  WHERE btm.business_id = b.id
                    AND btm.user_id = auth.uid()
                    AND btm.accepted_at IS NOT NULL
                )
              )
          )
        );
    $policy$;
  END IF;
END
$$;

-- Grants
GRANT SELECT ON TABLE public.menu_results_v2 TO authenticated;

REVOKE ALL ON FUNCTION public.claim_menu_result_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_menu_result_v2() TO service_role;

REVOKE ALL ON FUNCTION public.requeue_stale_menu_results_v2(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_stale_menu_results_v2(integer) TO service_role;
