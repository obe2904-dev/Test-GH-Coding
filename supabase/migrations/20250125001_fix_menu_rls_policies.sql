-- Fix menu_sources and menu_extractions RLS policies
-- The INSERT policies currently require created_by = auth.uid(), but the app doesn't always set this field
-- This migration drops and recreates the INSERT policies without the created_by requirement

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users can insert menu sources for their business" ON menu_sources;
DROP POLICY IF EXISTS "Users can insert menu extractions for their business" ON menu_extractions;

-- Recreate INSERT policy for menu_sources without created_by requirement
CREATE POLICY "Users can insert menu sources for their business"
  ON menu_sources FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Recreate INSERT policy for menu_extractions without created_by requirement
CREATE POLICY "Users can insert menu extractions for their business"
  ON menu_extractions FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Add comment explaining the change
COMMENT ON POLICY "Users can insert menu sources for their business" ON menu_sources IS 
'Allows users to insert menu sources for businesses they own. created_by check removed to allow Edge Functions to insert on behalf of users.';

COMMENT ON POLICY "Users can insert menu extractions for their business" ON menu_extractions IS 
'Allows users to insert menu extractions for businesses they own. created_by check removed to allow Edge Functions to insert on behalf of users.';
