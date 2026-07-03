-- Fix businesses table to ensure plan column exists
-- This migration ensures the plan column is added and provides fallback for existing data

-- Ensure plan column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'plan'
  ) THEN
    ALTER TABLE public.businesses 
    ADD COLUMN plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'standardplus', 'premium'));
    
    -- Add usage tracking columns if they don't exist
    ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS ai_generations_today INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ai_generations_this_month INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pdf_uploads_today INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pdf_uploads_this_month INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS website_analysis_today INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS website_analysis_this_month INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scheduled_posts_this_month INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_daily_reset DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE);
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_businesses_plan ON public.businesses(plan);
    
    RAISE NOTICE 'Added plan column and usage tracking to businesses table';
  ELSE
    RAISE NOTICE 'Plan column already exists in businesses table';
  END IF;
END $$;

-- Ensure all existing businesses have a plan value
UPDATE public.businesses 
SET plan = 'free' 
WHERE plan IS NULL;

-- Check for duplicate policies and remove them
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Drop old policies that might conflict
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'businesses' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.businesses', policy_record.policyname);
  END LOOP;
END $$;

-- Recreate clean RLS policies
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own business
CREATE POLICY "business_select_owner"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id);

-- Team members can view their business
CREATE POLICY "business_select_team"
  ON public.businesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_team_members
      WHERE business_id = businesses.id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
    )
  );

-- Only owners can insert businesses
CREATE POLICY "business_insert_owner"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can update business settings
CREATE POLICY "business_update_owner"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id);

-- Only owners can delete businesses
CREATE POLICY "business_delete_owner"
  ON public.businesses FOR DELETE
  USING (auth.uid() = owner_id);

-- Verify the setup
DO $$
DECLARE
  column_exists BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if plan column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'plan'
  ) INTO column_exists;
  
  -- Check policy count
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'businesses' 
  AND schemaname = 'public';
  
  RAISE NOTICE 'Setup verification:';
  RAISE NOTICE '  - Plan column exists: %', column_exists;
  RAISE NOTICE '  - Number of RLS policies: %', policy_count;
END $$;
