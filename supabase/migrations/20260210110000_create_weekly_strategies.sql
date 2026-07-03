-- =====================================================
-- WEEKLY STRATEGIES TABLE (Layer 0 Output Storage)
-- =====================================================
-- This table stores the strategic analysis from Layer 0
-- (get-weekly-strategy Edge Function). Users review the
-- 7 post ideas, select which ones to proceed with, then
-- Layer 1-9 generates the actual posts.
--
-- Flow:
-- 1. Layer 0 generates strategy → saved here
-- 2. User selects ideas (e.g., 1,3,5,6) → selected_idea_ids updated
-- 3. Layer 1-9 uses strategy_id to generate detailed posts
-- =====================================================

-- Create weekly_strategies table
CREATE TABLE IF NOT EXISTS public.weekly_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Week identification
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  is_current_week BOOLEAN DEFAULT FALSE,
  
  -- Strategy content (full Layer 0 output)
  narrative JSONB NOT NULL,                -- { headline, overview, detailed_sections }
  strategic_priorities JSONB NOT NULL,     -- Array of { focus, weight, rationale }
  post_ideas JSONB NOT NULL,               -- Array of 7 PostIdea objects
  selected_idea_ids INTEGER[] DEFAULT NULL, -- Set when user makes selection (e.g., [1,3,5,6])
  
  -- Context snapshot (for debugging + future ML)
  week_context_snapshot JSONB,             -- Full WeekContext used to generate
  
  -- Generation metadata
  business_type TEXT NOT NULL,
  country TEXT DEFAULT 'DK',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'ideas_selected', 'posts_created'))
);

-- Indexes
CREATE INDEX idx_weekly_strategies_business_id 
  ON public.weekly_strategies(business_id);

CREATE INDEX idx_weekly_strategies_week_start 
  ON public.weekly_strategies(business_id, week_start);

CREATE INDEX idx_weekly_strategies_status 
  ON public.weekly_strategies(business_id, status);

-- Unique constraint: one strategy per business per week
CREATE UNIQUE INDEX idx_weekly_strategies_unique_week 
  ON public.weekly_strategies(business_id, week_start);

-- RLS policies
ALTER TABLE public.weekly_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their business strategies"
  ON public.weekly_strategies FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their business strategies"
  ON public.weekly_strategies FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business strategies"
  ON public.weekly_strategies FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business strategies"
  ON public.weekly_strategies FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Comment
COMMENT ON TABLE public.weekly_strategies IS 'Layer 0 strategic analysis output. Stores 7 post ideas per week, user selection, and full context snapshot for debugging.';
COMMENT ON COLUMN public.weekly_strategies.selected_idea_ids IS 'Array of idea IDs (1-7) that user selected to proceed with. NULL until user makes selection.';
COMMENT ON COLUMN public.weekly_strategies.week_context_snapshot IS 'Full WeekContext JSON used to generate strategy. Useful for debugging and future ML training.';
COMMENT ON COLUMN public.weekly_strategies.status IS 'Workflow status: generated (fresh from Layer 0) → ideas_selected (user chose ideas) → posts_created (Layer 1-9 completed)';
