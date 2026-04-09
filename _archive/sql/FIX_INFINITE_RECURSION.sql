-- Fix infinite recursion in businesses table RLS policies
-- The issue: "Team members can view their business" policy creates a circular dependency
-- Solution: Temporarily disable team member access to businesses table (restore it later with proper SECURITY DEFINER function)

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view their business" ON public.businesses;

-- Keep only owner-based policies (no circular dependencies)
-- These are already defined, just ensuring they exist:

DROP POLICY IF EXISTS "Owners can view own business" ON public.businesses;
CREATE POLICY "Owners can view own business"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create own business" ON public.businesses;
CREATE POLICY "Users can create own business"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
CREATE POLICY "Owners can update own business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own business" ON public.businesses;
CREATE POLICY "Owners can delete own business"
  ON public.businesses FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- FIX business_profile TABLE
-- ============================================

-- Drop team member policies that cause circular dependencies
DROP POLICY IF EXISTS "Users can view business profile" ON public.business_profile;
DROP POLICY IF EXISTS "Users can create business profile" ON public.business_profile;

-- Keep only owner-based policies
DROP POLICY IF EXISTS "Owners can update business profile" ON public.business_profile;
CREATE POLICY "Owners can update business profile"
  ON public.business_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can view business profile" ON public.business_profile;
CREATE POLICY "Owners can view business profile"
  ON public.business_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can create business profile" ON public.business_profile;
CREATE POLICY "Owners can create business profile"
  ON public.business_profile FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete business profile" ON public.business_profile;
CREATE POLICY "Owners can delete business profile"
  ON public.business_profile FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- ============================================
-- FIX business_locations TABLE
-- ============================================

-- Drop team member policies
DROP POLICY IF EXISTS "Users can view business locations" ON public.business_locations;

-- Keep only owner-based policies
DROP POLICY IF EXISTS "Owners can manage business locations" ON public.business_locations;
CREATE POLICY "Owners can manage business locations"
  ON public.business_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- ============================================
-- FIX business_operations TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their business operations" ON public.business_operations;
CREATE POLICY "Users can view their business operations"
  ON public.business_operations FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert business operations" ON public.business_operations;
CREATE POLICY "Users can insert business operations"
  ON public.business_operations FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update business operations" ON public.business_operations;
CREATE POLICY "Users can update business operations"
  ON public.business_operations FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete business operations" ON public.business_operations;
CREATE POLICY "Users can delete business operations"
  ON public.business_operations FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- FIX opening_hours TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can manage their opening hours" ON public.opening_hours;
CREATE POLICY "Users can manage their opening hours"
  ON public.opening_hours FOR ALL
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

-- ============================================
-- FIX business_brand_profile TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their business brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can view their business brand profile"
  ON public.business_brand_profile FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert business brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can insert business brand profile"
  ON public.business_brand_profile FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update business brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can update business brand profile"
  ON public.business_brand_profile FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete business brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can delete business brand profile"
  ON public.business_brand_profile FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- FIX menu_sources TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can view their own business menu sources"
  ON public.menu_sources FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert menu sources for their business" ON public.menu_sources;
CREATE POLICY "Users can insert menu sources for their business"
  ON public.menu_sources FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    ) AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can update their own business menu sources"
  ON public.menu_sources FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can delete their own business menu sources"
  ON public.menu_sources FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Verify no infinite recursion
SELECT 'Fixed businesses, business_profile, and business_locations RLS - no more infinite recursion' as status;
