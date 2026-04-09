-- AGGRESSIVE FIX: Drop and recreate businesses table RLS policies
-- This will fix the 500 errors once and for all

-- Step 1: Disable RLS temporarily
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "business_select_owner" ON public.businesses;
DROP POLICY IF EXISTS "business_select_team" ON public.businesses;
DROP POLICY IF EXISTS "business_insert_owner" ON public.businesses;
DROP POLICY IF EXISTS "business_update_owner" ON public.businesses;
DROP POLICY IF EXISTS "business_delete_owner" ON public.businesses;
DROP POLICY IF EXISTS "Enable read access for business owners" ON public.businesses;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.businesses;
DROP POLICY IF EXISTS "Enable update for business owners" ON public.businesses;
DROP POLICY IF EXISTS "Enable delete for business owners" ON public.businesses;

-- Step 3: Re-enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Step 4: Create fresh, simple policies
CREATE POLICY "Allow owners to read their business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Allow owners to insert their business"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow owners to update their business"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow owners to delete their business"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Step 5: Add the plan column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'plan'
  ) THEN
    ALTER TABLE public.businesses 
    ADD COLUMN plan TEXT DEFAULT 'free';
  END IF;
END $$;

-- Step 6: Set default plan for existing businesses
UPDATE public.businesses 
SET plan = 'free' 
WHERE plan IS NULL OR plan = '';

-- Step 7: Test the policies
SELECT 
  'Policies' as check,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'businesses' 
AND schemaname = 'public';

SELECT
  'Columns' as check,
  column_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'businesses'
ORDER BY ordinal_position;
