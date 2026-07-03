-- Create posts table for unified post lifecycle
-- Replaces post_drafts + published_posts with single table

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  
  -- Platform selection
  platform TEXT CHECK (platform IS NULL OR platform IN ('facebook', 'instagram')),
  platforms TEXT[] DEFAULT '{}',
  
  -- Source tracking
  idea_source TEXT NOT NULL CHECK (idea_source IN ('write', 'quick_suggestions', 'weekly_plan', 'manual')),
  suggestion_id INTEGER REFERENCES public.daily_suggestions(id) ON DELETE SET NULL,
  weekly_plan_id UUID REFERENCES public.weekly_content_plans(id) ON DELETE SET NULL,
  weekly_plan_idea_id INTEGER,
  weekly_plan_slot_date DATE,
  weekly_plan_slot_index INTEGER,
  
  -- Content
  post_text TEXT,
  photo_url TEXT,
  content_json JSONB,
  photo_idea TEXT,
  caption_data JSONB,
  media_metadata JSONB,
  
  -- Classification
  content_type TEXT,
  menu_item_id UUID,
  menu_item_name TEXT,
  
  -- Timing
  suggested_post_datetime TIMESTAMPTZ,
  suggested_post_time TEXT,
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Publishing details
  source TEXT DEFAULT 'manual_copy_paste' CHECK (source IN ('manual_copy_paste', 'auto')),
  posting_error TEXT,
  
  -- Metadata
  idea_data JSONB DEFAULT '{}',
  media_analysis JSONB,
  phase TEXT DEFAULT 'publish',
  strategy_id UUID REFERENCES public.weekly_content_plans(id) ON DELETE SET NULL,
  idea_index INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_business_status 
  ON public.posts(business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_drafts
  ON public.posts(business_id, updated_at DESC)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_posts_weekly_plan_slot
  ON public.posts(business_id, weekly_plan_slot_date, status)
  WHERE weekly_plan_slot_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_suggestion
  ON public.posts(business_id, suggestion_id, status)
  WHERE suggestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_user
  ON public.posts(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

CREATE POLICY "Users can read own posts"
  ON public.posts FOR SELECT
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert own posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Comments
COMMENT ON TABLE public.posts IS 
  'Unified post storage: draft → scheduled → published → archived';

COMMENT ON COLUMN public.posts.content_json IS
  'Full PostContent snapshot: text, hashtags, adjustments, platform-specific content';

COMMENT ON COLUMN public.posts.updated_at IS
  'Last update timestamp for draft tracking and cleanup';
