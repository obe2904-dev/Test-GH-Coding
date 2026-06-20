-- ============================================================================
-- ADD RLS POLICIES TO website_analyses TABLE
-- ============================================================================
-- The website_analyses table was created without RLS policies,
-- causing frontend queries to be blocked even though users own the data
-- ============================================================================

-- Enable RLS (if not already enabled)
ALTER TABLE public.website_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view their business website analyses" ON public.website_analyses;

-- Create policy: Users can view website analyses for their own businesses
CREATE POLICY "Users can view their business website analyses"
  ON public.website_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = website_analyses.business_id
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

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert website analyses for their business" ON public.website_analyses;

-- Create policy: Users can insert analyses for their own businesses
CREATE POLICY "Users can insert website analyses for their business"
  ON public.website_analyses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = website_analyses.business_id
        AND b.owner_id = auth.uid()
    )
  );

-- Drop existing update policy if it exists  
DROP POLICY IF EXISTS "Users can update their business website analyses" ON public.website_analyses;

-- Create policy: Users can update analyses for their own businesses
CREATE POLICY "Users can update their business website analyses"
  ON public.website_analyses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = website_analyses.business_id
        AND b.owner_id = auth.uid()
    )
  );

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'website_analyses'
ORDER BY policyname;
