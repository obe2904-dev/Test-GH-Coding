-- Task 4.1: Add Programme Revenue Weights to business_brand_profile
-- This enables businesses to set revenue importance per programme (e.g., Aftensmad = 40%, Frokost = 35%)
-- Used by Weekly Plan programme rotation to balance content according to business priorities

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS programme_revenue_weights JSONB;

COMMENT ON COLUMN business_brand_profile.programme_revenue_weights IS 
'Revenue importance weights per programme for content rotation. 
Structure: { 
  "Brunch": 25, 
  "Frokost": 30, 
  "Aftensmad": 35, 
  "Cocktails": 10 
}
Values represent relative importance (0-100 scale). Higher values = more revenue-critical programme.
Used by calculateProgrammePriorities() in Weekly Plan to allocate 0-20 points to revenue score.
Default behavior (null): All programmes equally weighted (10 points each).';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Task 4.1 migration complete: programme_revenue_weights column added';
  RAISE NOTICE 'Column is optional (JSONB, defaults to NULL)';
  RAISE NOTICE 'UI will be added to Brand Profile page for businesses to set weights via sliders';
END $$;
