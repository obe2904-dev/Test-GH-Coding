-- Fix RLS policies for daily_suggestions to allow caching generated content
-- Issue: PATCH succeeds but SELECT can't read the cached data

-- Drop existing policies if they exist (to recreate with correct permissions)
DROP POLICY IF EXISTS "Users can update their business suggestions" ON public.daily_suggestions;
DROP POLICY IF EXISTS "Enable update for users based on business_id" ON public.daily_suggestions;

-- Ensure SELECT policy exists and is correct
DROP POLICY IF EXISTS "Users can view their business suggestions" ON public.daily_suggestions;
CREATE POLICY "Users can view their business suggestions"
  ON public.daily_suggestions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Add UPDATE policy to allow caching generated content
CREATE POLICY "Users can update their business suggestions"
  ON public.daily_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Verify policies are active
COMMENT ON POLICY "Users can view their business suggestions" ON public.daily_suggestions 
  IS 'Allows users to SELECT their own business suggestions including cached generated content';

COMMENT ON POLICY "Users can update their business suggestions" ON public.daily_suggestions 
  IS 'Allows users to UPDATE their own suggestions to cache generated content (text, hashtags, etc.)';
