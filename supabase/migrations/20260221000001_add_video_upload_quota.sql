-- Add video upload quota tracking to businesses table
-- Free tier: 2 videos per week
-- Smart/Pro: Unlimited

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS video_uploads_this_week INTEGER DEFAULT 0;

COMMENT ON COLUMN businesses.video_uploads_this_week IS 'Number of videos uploaded this week (resets Monday 00:00)';

-- Function to reset weekly video quota (runs every Monday at 00:00)
CREATE OR REPLACE FUNCTION reset_weekly_video_quota()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE businesses
  SET video_uploads_this_week = 0
  WHERE video_uploads_this_week > 0;
  
  RAISE NOTICE 'Weekly video quota reset completed at %', NOW();
END;
$$;

COMMENT ON FUNCTION reset_weekly_video_quota() IS 'Resets video_uploads_this_week counter for all businesses';
