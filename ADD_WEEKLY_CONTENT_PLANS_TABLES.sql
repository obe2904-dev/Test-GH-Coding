-- Create weekly_content_plans table
CREATE TABLE IF NOT EXISTS weekly_content_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Post specifications (array of PostSpecification objects)
  posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Summary statistics
  summary JSONB DEFAULT '{}'::jsonb,
  
  -- Learning data (user edit patterns for feedback loop)
  learning_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create post_approvals table for tracking individual post status
CREATE TABLE IF NOT EXISTS post_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES weekly_content_plans(id) ON DELETE CASCADE,
  post_index INT NOT NULL,
  
  -- Approval workflow
  status TEXT CHECK (status IN ('draft', 'approved', 'scheduled', 'posted')) DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Media management
  media_uploads JSONB DEFAULT '[]'::jsonb,
  selected_media TEXT,
  
  -- Edit tracking for learning system
  edit_history JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plan_id, post_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_content_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_business ON weekly_content_plans(business_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week_start ON weekly_content_plans(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week ON weekly_content_plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_post_approvals_plan ON post_approvals(plan_id);
CREATE INDEX IF NOT EXISTS idx_post_approvals_status ON post_approvals(status);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS update_weekly_plans_updated_at ON weekly_content_plans;
CREATE TRIGGER update_weekly_plans_updated_at 
  BEFORE UPDATE ON weekly_content_plans 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_approvals_updated_at ON post_approvals;
CREATE TRIGGER update_post_approvals_updated_at 
  BEFORE UPDATE ON post_approvals 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE weekly_content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_content_plans
DROP POLICY IF EXISTS "Users can view their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can view their own weekly plans" 
  ON weekly_content_plans FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can create their own weekly plans" 
  ON weekly_content_plans FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can update their own weekly plans" 
  ON weekly_content_plans FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own weekly plans" ON weekly_content_plans;
CREATE POLICY "Users can delete their own weekly plans" 
  ON weekly_content_plans FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for post_approvals
DROP POLICY IF EXISTS "Users can view post approvals from their plans" ON post_approvals;
CREATE POLICY "Users can view post approvals from their plans" 
  ON post_approvals FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM weekly_content_plans 
      WHERE weekly_content_plans.id = post_approvals.plan_id 
      AND weekly_content_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create post approvals for their plans" ON post_approvals;
CREATE POLICY "Users can create post approvals for their plans" 
  ON post_approvals FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_content_plans 
      WHERE weekly_content_plans.id = post_approvals.plan_id 
      AND weekly_content_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update post approvals for their plans" ON post_approvals;
CREATE POLICY "Users can update post approvals for their plans" 
  ON post_approvals FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM weekly_content_plans 
      WHERE weekly_content_plans.id = post_approvals.plan_id 
      AND weekly_content_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete post approvals for their plans" ON post_approvals;
CREATE POLICY "Users can delete post approvals for their plans" 
  ON post_approvals FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM weekly_content_plans 
      WHERE weekly_content_plans.id = post_approvals.plan_id 
      AND weekly_content_plans.user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE weekly_content_plans IS 'Stores AI-generated weekly content plans with 4-7 post specifications';
COMMENT ON TABLE post_approvals IS 'Tracks approval status, media uploads, and edit history for individual posts';
COMMENT ON COLUMN weekly_content_plans.posts IS 'Array of complete post specifications (timing, platform, caption, visual, etc.)';
COMMENT ON COLUMN weekly_content_plans.summary IS 'Aggregated statistics (platform distribution, format distribution, production time)';
COMMENT ON COLUMN weekly_content_plans.learning_data IS 'User edit patterns for AI learning feedback loop';
COMMENT ON COLUMN post_approvals.edit_history IS 'Tracks caption edits, timing changes, platform swaps for learning system';
