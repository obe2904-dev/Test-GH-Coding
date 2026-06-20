-- Add cover_url to daily_suggestions for Reel cover selection.
-- This column stores the user-chosen cover frame public URL, extracted client-side
-- from the uploaded video and selected in the Design step.
--
-- Used by the Graph API publishing Edge Function as:
--   Instagram Reels: cover_url parameter on container creation
--   Facebook  Reels: video_cover_image_url parameter on creation
--
-- NOTE: Must be set at publish time — Meta does not allow cover updates post-publish via API.

ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

COMMENT ON COLUMN public.daily_suggestions.cover_url IS
  'Public storage URL of the user-chosen Reel cover frame. '
  'Passed to Graph API as cover_url (Instagram) / video_cover_image_url (Facebook) '
  'at publish time. Must be a publicly accessible URL.';
