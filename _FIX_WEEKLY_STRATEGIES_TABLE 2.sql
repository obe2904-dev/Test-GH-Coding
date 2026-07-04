-- =====================================================
-- FIX: Apply missing weekly_strategies table migrations
-- =====================================================
-- This combines all 3 migration files that were never deployed
-- Order: 20260210110000, 20260211000002, 20260315000000

-- ──────────────────────────────────────────────────────
-- STEP 1: Create weekly_strategies table
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Week identification
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  is_current_week BOOLEAN DEFAULT FALSE,
  
  -- Strategy content (full Layer 0 output)
  narrative JSONB NOT NULL,
  strategic_priorities JSONB NOT NULL,
  post_ideas JSONB NOT NULL,
  selected_idea_ids INTEGER[] DEFAULT NULL,
  
  -- Context snapshot (for debugging + future ML)
  week_context_snapshot JSONB,
  
  -- Generation metadata
  business_type TEXT NOT NULL,
  country TEXT DEFAULT 'DK',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking (will be enhanced in step 3)
  status TEXT DEFAULT 'generated'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_strategies_business_id 
  ON public.weekly_strategies(business_id);

CREATE INDEX IF NOT EXISTS idx_weekly_strategies_week_start 
  ON public.weekly_strategies(business_id, week_start);

CREATE INDEX IF NOT EXISTS idx_weekly_strategies_status 
  ON public.weekly_strategies(business_id, status);

-- Unique constraint: one strategy per business per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_strategies_unique_week 
  ON public.weekly_strategies(business_id, week_start);

-- RLS policies
ALTER TABLE public.weekly_strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business strategies" ON public.weekly_strategies;
CREATE POLICY "Users can view their business strategies"
  ON public.weekly_strategies FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their business strategies" ON public.weekly_strategies;
CREATE POLICY "Users can insert their business strategies"
  ON public.weekly_strategies FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their business strategies" ON public.weekly_strategies;
CREATE POLICY "Users can update their business strategies"
  ON public.weekly_strategies FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their business strategies" ON public.weekly_strategies;
CREATE POLICY "Users can delete their business strategies"
  ON public.weekly_strategies FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────
-- STEP 2: Add platform, tier, and post count metadata
-- ──────────────────────────────────────────────────────

ALTER TABLE public.weekly_strategies 
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'smart',
ADD COLUMN IF NOT EXISTS target_post_count INTEGER DEFAULT 5;

-- ──────────────────────────────────────────────────────
-- STEP 3: Add pending and error status values
-- ──────────────────────────────────────────────────────

-- Drop the existing check constraint if it exists
ALTER TABLE public.weekly_strategies
  DROP CONSTRAINT IF EXISTS weekly_strategies_status_check;

-- Re-add with expanded value set
ALTER TABLE public.weekly_strategies
  ADD CONSTRAINT weekly_strategies_status_check
  CHECK (status IN ('pending', 'generated', 'ideas_selected', 'posts_created', 'error'));

-- ──────────────────────────────────────────────────────
-- Comments for documentation
-- ──────────────────────────────────────────────────────

COMMENT ON TABLE public.weekly_strategies IS 'Layer 0 strategic analysis output. Stores 7 post ideas per week, user selection, and full context snapshot.';
COMMENT ON COLUMN public.weekly_strategies.selected_idea_ids IS 'Array of idea IDs (1-7) that user selected to proceed with. NULL until user makes selection.';
COMMENT ON COLUMN public.weekly_strategies.week_context_snapshot IS 'Full WeekContext JSON used to generate strategy. Useful for debugging and future ML training.';
COMMENT ON COLUMN public.weekly_strategies.platforms IS 'Active social media platforms for this strategy';
COMMENT ON COLUMN public.weekly_strategies.subscription_tier IS 'Subscription tier (smart or pro) at time of generation';
COMMENT ON COLUMN public.weekly_strategies.target_post_count IS 'Number of post ideas generated based on preferred_posts_per_week';
COMMENT ON COLUMN public.weekly_strategies.status IS 'Workflow status: pending → generated → ideas_selected → posts_created | error';
