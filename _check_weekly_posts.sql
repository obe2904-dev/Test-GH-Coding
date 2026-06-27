-- Check the actual posts saved for this weekly plan
SELECT 
  id,
  post_date,
  post_time,
  content_type,
  service_period,
  programme_type,
  caption_facebook,
  cta_type,
  booking_nudge_applied,
  created_at
FROM business_weekly_posts
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  AND week_number = 26
ORDER BY post_date, post_time;
