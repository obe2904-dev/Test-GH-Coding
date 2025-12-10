-- Create post_drafts table for saving draft posts
CREATE TABLE IF NOT EXISTS public.post_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_platforms TEXT[] DEFAULT '{}',
  post_content JSONB,
  photo_content JSONB,
  photo_idea TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT post_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_drafts_user_id ON public.post_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_drafts_updated_at ON public.post_drafts(updated_at DESC);

-- Enable RLS
ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own drafts"
  ON public.post_drafts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
  ON public.post_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.post_drafts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.post_drafts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
