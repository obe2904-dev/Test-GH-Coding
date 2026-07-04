-- Create suggested_posts table for tracking generated and published posts
-- This allows the AI to learn from past posts and avoid repetition

CREATE TABLE IF NOT EXISTS public.suggested_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Post content (stores the actual post text/caption)
  post_content TEXT NOT NULL,
  
  -- Platform targeting
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'twitter', 'tiktok')),
  
  -- Post metadata
  idea_source TEXT, -- e.g., 'menu', 'vibe', 'occasion', 'seasonal'
  slot_id TEXT, -- e.g., 'A', 'B', 'C' for the 3-slot system
  
  -- Publishing status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_suggested_posts_user_id ON public.suggested_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_business_id ON public.suggested_posts(business_id);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_status ON public.suggested_posts(status);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_created_at ON public.suggested_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_platform ON public.suggested_posts(platform);

-- Index for querying published posts by user (for learning patterns)
CREATE INDEX IF NOT EXISTS idx_suggested_posts_published_lookup 
  ON public.suggested_posts(user_id, status, created_at DESC) 
  WHERE status = 'published';

-- Enable RLS
ALTER TABLE public.suggested_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own posts"
  ON public.suggested_posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts"
  ON public.suggested_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.suggested_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.suggested_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suggested_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_suggested_posts_updated_at
  BEFORE UPDATE ON public.suggested_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_suggested_posts_updated_at();

-- Function to clean up old archived posts (optional - run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_archived_posts(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.suggested_posts
  WHERE status = 'archived'
    AND updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_archived_posts TO service_role;

COMMENT ON TABLE public.suggested_posts IS 'Stores AI-generated post suggestions and their publishing status';
COMMENT ON COLUMN public.suggested_posts.post_content IS 'The actual post text/caption';
COMMENT ON COLUMN public.suggested_posts.status IS 'Lifecycle status: draft -> scheduled -> published/failed -> archived';
COMMENT ON COLUMN public.suggested_posts.idea_source IS 'What triggered this post idea (menu, vibe, occasion, etc)';
