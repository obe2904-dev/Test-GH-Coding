-- Drop old posts table and recreate with correct structure
-- Based on daily_suggestions format and post creation flow

DROP TABLE IF EXISTS public.posts CASCADE;

CREATE TABLE public.posts (
  -- Primary identification
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived', 'consumed')),
  
  -- Platform selection
  platform TEXT CHECK (platform IS NULL OR platform IN ('facebook', 'instagram')),
  platforms TEXT[] DEFAULT '{}',
  platforms_generated TEXT[] DEFAULT '{}',
  
  -- Source tracking
  idea_source TEXT NOT NULL DEFAULT 'manual' CHECK (idea_source IN ('manual', 'quick_suggestions', 'weekly_plan', 'write')),
  source TEXT DEFAULT 'manual_copy_paste' CHECK (source IN ('manual_copy_paste', 'auto')),
  suggestion_id INTEGER REFERENCES public.daily_suggestions(id) ON DELETE SET NULL,
  weekly_plan_id UUID REFERENCES public.weekly_content_plans(id) ON DELETE SET NULL,
  weekly_plan_idea_id INTEGER,
  weekly_plan_slot_date DATE,
  weekly_plan_slot_index INTEGER,
  
  -- Menu item reference
  menu_item_id UUID,
  menu_item_name TEXT,
  menu_item_description TEXT,
  
  -- Content type and classification
  content_type TEXT,
  content_angle TEXT,
  service_period TEXT,
  
  -- Text content
  title TEXT,
  post_text TEXT,
  generated_text TEXT,
  caption_base TEXT,
  
  -- Hashtags and platform-specific content
  generated_hashtags JSONB DEFAULT '[]',
  generated_platform_content JSONB DEFAULT '{}',
  
  -- Media
  photo_url TEXT,
  uploaded_photo_url TEXT,
  photo_idea TEXT,
  media_suggestion JSONB,
  media_metadata JSONB,
  photo_analysis JSONB,
  media_items JSONB,
  
  -- CTA and engagement
  cta_intent TEXT,
  
  -- AI generation tracking
  text_generated_count INTEGER DEFAULT 0,
  text_generation_version INTEGER,
  first_text_generated_at TIMESTAMPTZ,
  last_text_generated_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  
  -- Rationale and context
  rationale TEXT,
  why_explanation TEXT,
  planner_rationale TEXT,
  occasion_context TEXT,
  
  -- Weather context
  weather_forecast JSONB,
  
  -- Timing
  date DATE,
  suggested_time TEXT,
  suggested_post_datetime TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Selection and consumption tracking
  is_active BOOLEAN DEFAULT true,
  selected BOOLEAN DEFAULT false,
  selected_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  
  -- Publishing details
  posting_error TEXT,
  
  -- Batch tracking
  generation_batch_id UUID,
  
  -- Validation
  validation_result JSONB,
  
  -- Legacy/additional fields
  content_json JSONB,
  caption_data JSONB,
  idea_data JSONB DEFAULT '{}',
  media_analysis JSONB,
  phase TEXT DEFAULT 'publish',
  strategy_id UUID REFERENCES public.weekly_content_plans(id) ON DELETE SET NULL,
  idea_index INTEGER DEFAULT 0,
  position INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_business_status 
  ON public.posts(business_id, status, created_at DESC);

CREATE INDEX idx_posts_drafts
  ON public.posts(business_id, updated_at DESC)
  WHERE status = 'draft';

CREATE INDEX idx_posts_scheduled
  ON public.posts(business_id, scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX idx_posts_published
  ON public.posts(business_id, posted_at DESC)
  WHERE status = 'published';

CREATE INDEX idx_posts_weekly_plan_slot
  ON public.posts(business_id, weekly_plan_slot_date, status)
  WHERE weekly_plan_slot_date IS NOT NULL;

CREATE INDEX idx_posts_suggestion
  ON public.posts(business_id, suggestion_id, status)
  WHERE suggestion_id IS NOT NULL;

CREATE INDEX idx_posts_user
  ON public.posts(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_posts_date
  ON public.posts(business_id, date DESC)
  WHERE date IS NOT NULL;

-- Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business posts"
  ON public.posts FOR SELECT
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own business posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own business posts"
  ON public.posts FOR UPDATE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own business posts"
  ON public.posts FOR DELETE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- Comments
COMMENT ON TABLE public.posts IS 
  'Unified post storage: draft → scheduled → published → archived. Supports quick_suggestions, weekly_plan, and manual creation flows.';

COMMENT ON COLUMN public.posts.idea_source IS
  'Where the post idea originated: manual, quick_suggestions, weekly_plan, write';

COMMENT ON COLUMN public.posts.source IS
  'Publishing method: manual_copy_paste or auto';

COMMENT ON COLUMN public.posts.status IS
  'Lifecycle: draft (being edited), scheduled (queued), published (posted), archived (hidden), consumed (used from daily_suggestions)';

COMMENT ON COLUMN public.posts.generated_platform_content IS
  'Platform-specific content with text, hashtags, and CTA for each platform';
