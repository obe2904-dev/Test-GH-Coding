-- Migration: Add Row Level Security policies for team member access
-- Team members can use the platform but cannot delete content or manage users

-- ============================================
-- BUSINESSES TABLE
-- ============================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own business
CREATE POLICY "Owners can view own business"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id);

-- Team members can view their business
CREATE POLICY "Team members can view their business"
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
CREATE POLICY "Users can create own business"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can update business settings
CREATE POLICY "Owners can update own business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id);

-- Only owners can delete businesses
CREATE POLICY "Owners can delete own business"
  ON public.businesses FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- BUSINESS PROFILE TABLE
-- ============================================
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

-- Both owners and team members can view
CREATE POLICY "Users can view business profile"
  ON public.business_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Only owners can update business profile
CREATE POLICY "Owners can update business profile"
  ON public.business_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- Both owners and team members can insert (for initial setup)
CREATE POLICY "Users can create business profile"
  ON public.business_profile FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Only owners can delete
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
-- BUSINESS LOCATIONS TABLE
-- ============================================
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

-- Both owners and team members can view
CREATE POLICY "Users can view business locations"
  ON public.business_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Only owners can modify locations
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
-- BUSINESS TEAM MEMBERS TABLE
-- ============================================
ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

-- Owners can view all team members
CREATE POLICY "Owners can view team members"
  ON public.business_team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- Team members can view other team members
CREATE POLICY "Team members can view other members"
  ON public.business_team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_team_members btm
      WHERE btm.business_id = business_team_members.business_id
      AND btm.user_id = auth.uid()
      AND btm.accepted_at IS NOT NULL
    )
  );

-- Only owners can add team members
CREATE POLICY "Owners can add team members"
  ON public.business_team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- Only owners can remove team members
CREATE POLICY "Owners can remove team members"
  ON public.business_team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- Team members can accept their own invitation
CREATE POLICY "Members can accept own invitation"
  ON public.business_team_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- POST DRAFTS (if exists)
-- ============================================
-- Note: Assuming you have a post_drafts table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_drafts') THEN
    -- Enable RLS if not already enabled
    EXECUTE 'ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY';
    
    -- Drop existing policies first
    DROP POLICY IF EXISTS "Users can create posts" ON public.post_drafts;
    DROP POLICY IF EXISTS "Users can view posts" ON public.post_drafts;
    DROP POLICY IF EXISTS "Users can update posts" ON public.post_drafts;
    DROP POLICY IF EXISTS "Users can delete own posts or owner deletes all" ON public.post_drafts;
    
    -- Both owners and team members can create posts
    EXECUTE '
      CREATE POLICY "Users can create posts"
        ON public.post_drafts FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.owner_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.business_team_members btm
              WHERE btm.business_id = b.id
              AND btm.user_id = auth.uid()
              AND btm.accepted_at IS NOT NULL
            )
          )
        )
    ';
    
    -- Both can view
    EXECUTE '
      CREATE POLICY "Users can view posts"
        ON public.post_drafts FOR SELECT
        USING (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.owner_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.business_team_members btm
              WHERE btm.business_id = b.id
              AND btm.user_id = auth.uid()
              AND btm.accepted_at IS NOT NULL
            )
          )
        )
    ';
    
    -- Both can update their own or team posts
    EXECUTE '
      CREATE POLICY "Users can update posts"
        ON public.post_drafts FOR UPDATE
        USING (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.owner_id = auth.uid()
          )
        )
    ';
    
    -- Only creators and owners can delete
    EXECUTE '
      CREATE POLICY "Users can delete own posts or owner deletes all"
        ON public.post_drafts FOR DELETE
        USING (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.owner_id = auth.uid()
          )
        )
    ';
  END IF;
END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is business owner
CREATE OR REPLACE FUNCTION public.is_business_owner(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = business_uuid
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is team member
CREATE OR REPLACE FUNCTION public.is_team_member(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_team_members
    WHERE business_id = business_uuid
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access to business (owner or team member)
CREATE OR REPLACE FUNCTION public.has_business_access(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    public.is_business_owner(business_uuid)
    OR public.is_team_member(business_uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_business_access(UUID) TO authenticated;
