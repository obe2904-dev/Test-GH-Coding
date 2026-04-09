-- Create daily_suggestions table for quick AI-generated content ideas
-- These are lightweight suggestions shown on the dashboard

CREATE TABLE IF NOT EXISTS public.daily_suggestions (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Suggestion content
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('menu_item', 'atmosphere', 'behind_scenes', 'seasonal', 'event')),
  suggested_time TEXT, -- e.g., "12:00", "Evening"
  
  -- Metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE, -- Which day these suggestions are for
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 3), -- 1, 2, or 3
  
  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE, -- FALSE when user dismisses or regenerates
  selected BOOLEAN DEFAULT FALSE, -- TRUE when user clicks on this suggestion
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only 3 active suggestions per business per day
  UNIQUE(business_id, date, position)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_business_date 
  ON public.daily_suggestions(business_id, date, is_active) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_created 
  ON public.daily_suggestions(created_at DESC);

-- Enable RLS
ALTER TABLE public.daily_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see suggestions for their own businesses
CREATE POLICY "Users can view their business suggestions"
  ON public.daily_suggestions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all suggestions"
  ON public.daily_suggestions
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_daily_suggestions_updated_at
  BEFORE UPDATE ON public.daily_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_suggestions_updated_at();

-- Function to deactivate old suggestions when generating new ones
CREATE OR REPLACE FUNCTION deactivate_old_suggestions(p_business_id UUID, p_date DATE)
RETURNS VOID AS $$
BEGIN
  UPDATE public.daily_suggestions
  SET is_active = FALSE
  WHERE business_id = p_business_id
    AND date = p_date
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION deactivate_old_suggestions TO service_role;

COMMENT ON TABLE public.daily_suggestions IS 'Stores AI-generated quick content suggestions shown on the dashboard';
COMMENT ON COLUMN public.daily_suggestions.position IS 'Position in the 3-suggestion list (1, 2, or 3)';
COMMENT ON COLUMN public.daily_suggestions.is_active IS 'FALSE when user regenerates or dismisses suggestions';
