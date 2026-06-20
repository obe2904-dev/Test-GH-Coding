-- Fix posts table: ensure suggested_time column exists (not suggested_post_time)
-- This migration handles both scenarios:
-- 1. If suggested_post_time exists, rename it to suggested_time
-- 2. If neither exists, add suggested_time

DO $$
BEGIN
  -- Check if suggested_post_time exists and rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'suggested_post_time'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN suggested_post_time TO suggested_time;
    RAISE NOTICE 'Renamed suggested_post_time to suggested_time';
  END IF;

  -- Check if suggested_time exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'suggested_time'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN suggested_time TEXT;
    RAISE NOTICE 'Added suggested_time column';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.posts.suggested_time IS 
  'Suggested posting time from AI (HH:MM format, e.g. "19:30")';
