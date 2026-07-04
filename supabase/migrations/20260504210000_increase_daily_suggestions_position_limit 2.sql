-- Increase daily_suggestions position limit from 3 to 5 posts per day
-- Required to support 4-5 posts per week spread across fewer days

-- Step 1: Drop the old CHECK constraint
ALTER TABLE public.daily_suggestions
  DROP CONSTRAINT IF EXISTS daily_suggestions_position_check;

-- Step 2: Add new CHECK constraint allowing positions 1-5
ALTER TABLE public.daily_suggestions
  ADD CONSTRAINT daily_suggestions_position_check 
  CHECK (position >= 1 AND position <= 5);

-- Update comment to reflect new limit
COMMENT ON COLUMN public.daily_suggestions.position IS 'Position of suggestion on the day (1-5). Enforced by CHECK constraint and UNIQUE index.';
