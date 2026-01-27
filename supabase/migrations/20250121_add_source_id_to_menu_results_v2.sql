-- Add source_id column to menu_results_v2 to track which menu_source this result belongs to
-- This allows safe retry/deletion without affecting other menus with the same URL

ALTER TABLE public.menu_results_v2
ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.menu_sources(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_source_id ON public.menu_results_v2(source_id);

-- Backfill existing rows: try to match by source_url + business_id (will be NULL if ambiguous)
-- This is a best-effort migration - new extractions will have source_id populated correctly
UPDATE public.menu_results_v2 r
SET source_id = (
  SELECT s.id
  FROM public.menu_sources s
  WHERE s.business_id = r.business_id
    AND s.source_url = r.source_url
  LIMIT 1
)
WHERE r.source_id IS NULL
  AND r.source_url IS NOT NULL;

COMMENT ON COLUMN public.menu_results_v2.source_id IS 'References menu_sources.id - which menu source this extraction result belongs to';
