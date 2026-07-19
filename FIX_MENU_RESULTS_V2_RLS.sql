-- Fix RLS Policies for menu_results_v2
-- Problem: INSERT is being blocked by RLS policy
-- Solution: Add proper policies for authenticated users

-- Step 1: Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'menu_results_v2'
ORDER BY cmd, policyname;

-- Step 2: Enable RLS if not already enabled
ALTER TABLE menu_results_v2 ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies (if any) to start fresh
DROP POLICY IF EXISTS "Users can view their business menu results" ON menu_results_v2;
DROP POLICY IF EXISTS "Users can insert menu results for their business" ON menu_results_v2;
DROP POLICY IF EXISTS "Users can update their business menu results" ON menu_results_v2;
DROP POLICY IF EXISTS "Users can delete their business menu results" ON menu_results_v2;

-- Step 4: Create SELECT policy
CREATE POLICY "Users can view their business menu results"
ON menu_results_v2
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id 
    FROM businesses 
    WHERE owner_id = auth.uid()
  )
);

-- Step 5: Create INSERT policy
CREATE POLICY "Users can insert menu results for their business"
ON menu_results_v2
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id 
    FROM businesses 
    WHERE owner_id = auth.uid()
  )
);

-- Step 6: Create UPDATE policy
CREATE POLICY "Users can update their business menu results"
ON menu_results_v2
FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id 
    FROM businesses 
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT id 
    FROM businesses 
    WHERE owner_id = auth.uid()
  )
);

-- Step 7: Create DELETE policy
CREATE POLICY "Users can delete their business menu results"
ON menu_results_v2
FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id 
    FROM businesses 
    WHERE owner_id = auth.uid()
  )
);

-- Step 8: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'menu_results_v2'
ORDER BY cmd, policyname;
