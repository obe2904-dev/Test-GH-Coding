-- Menu extraction queue hardening (v2)
-- Adds: source metadata, language, retry fields, and an atomic claim RPC.

DO $$
BEGIN
  -- Make pdf_url nullable (storage-based jobs may not need an external URL)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_results'
      AND column_name = 'pdf_url'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.menu_results ALTER COLUMN pdf_url DROP NOT NULL;
  END IF;

  -- Only run if menu_results table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_results') THEN
    ALTER TABLE public.menu_results
      ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'url',
      ADD COLUMN IF NOT EXISTS pdf_bucket text,
      ADD COLUMN IF NOT EXISTS pdf_path text,
      ADD COLUMN IF NOT EXISTS language_code text DEFAULT 'da',
      ADD COLUMN IF NOT EXISTS pdf_sha256 text,
      ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS extraction_method text;
  END IF;
END $$;

-- Basic constraint (only add if not already present)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_results') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'menu_results_source_type_check'
    ) THEN
      ALTER TABLE public.menu_results
        ADD CONSTRAINT menu_results_source_type_check
        CHECK (source_type IN ('url', 'storage'));
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_results') THEN
    CREATE INDEX IF NOT EXISTS idx_menu_results_claimed_at ON public.menu_results(claimed_at);
    CREATE INDEX IF NOT EXISTS idx_menu_results_sha ON public.menu_results(pdf_sha256);
  END IF;
END $$;

-- Atomic claim function: returns a single queued job and marks it processing.
-- Uses SKIP LOCKED to prevent multiple workers claiming the same job.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_results') THEN
    CREATE OR REPLACE FUNCTION public.claim_menu_result()
    RETURNS public.menu_results
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      claimed public.menu_results;
    BEGIN
      WITH next_job AS (
        SELECT id
        FROM public.menu_results
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE public.menu_results mr
      SET
        status = 'processing',
        claimed_at = now(),
        attempts = mr.attempts + 1
      WHERE mr.id IN (SELECT id FROM next_job)
      RETURNING mr.* INTO claimed;

      RETURN claimed;
    END;
    $function$;
  END IF;
END $$;
