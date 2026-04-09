-- ============================================================================
-- LAYER 9 DATABASE TEST: Weekly Plan Output Assembly
-- Tests the final output structure and data flow from Layers 1-8
-- ============================================================================

\echo '\n=== LAYER 9: WEEKLY PLAN OUTPUT ASSEMBLY ==='
\echo 'Testing final weekly content plan structure and completeness\n'

-- Test 1: Weekly Content Plans Table Structure
\echo '1. Testing weekly_content_plans table...'
SELECT 
  COUNT(*) as weekly_plans_exist,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_plans,
  COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_plans
FROM weekly_content_plans
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Test 2: Weekly Posts Table with Layer 8 Captions
\echo '\n2. Testing weekly_posts with AI-generated captions...'
SELECT 
  wp.post_date,
  wp.content_type,
  wp.platform,
  LENGTH(wp.caption) as caption_length,
  array_length(wp.hashtags, 1) as hashtag_count,
  wp.emoji_count,
  wp.optimal_posting_time,
  wp.status
FROM weekly_posts wp
JOIN weekly_content_plans wcp ON wp.plan_id = wcp.id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
ORDER BY wp.post_date
LIMIT 5;

-- Test 3: Complete Weekly Plan Assembly (All Layers)
\echo '\n3. Testing complete data flow (Layers 1-8 → Layer 9)...'
SELECT 
  -- Layer 1: Business Context
  b.business_name,
  b.business_category,
  b.city,
  b.country,
  
  -- Layer 2: Brand Voice
  bbp.tone_keywords,
  bbp.voice_style,
  
  -- Layer 3: Content Opportunities
  COUNT(DISTINCT wp.id) as total_posts,
  
  -- Layer 4: Performance (if available)
  AVG(ph.engagement_rate) as avg_engagement,
  
  -- Layer 7: Platform Distribution
  COUNT(CASE WHEN wp.platform = 'instagram' THEN 1 END) as instagram_posts,
  COUNT(CASE WHEN wp.platform = 'facebook' THEN 1 END) as facebook_posts,
  
  -- Layer 8: AI Caption Quality
  AVG(LENGTH(wp.caption)) as avg_caption_length,
  AVG(array_length(wp.hashtags, 1)) as avg_hashtags,
  
  -- Layer 9: Plan Completeness
  wcp.week_start_date,
  wcp.status,
  wcp.created_at
FROM businesses b
LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
LEFT JOIN weekly_content_plans wcp ON b.id = wcp.business_id
LEFT JOIN weekly_posts wp ON wcp.id = wp.plan_id
LEFT JOIN post_history ph ON b.id = ph.business_id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
GROUP BY 
  b.business_name, b.business_category, b.city, b.country,
  bbp.tone_keywords, bbp.voice_style,
  wcp.week_start_date, wcp.status, wcp.created_at;

-- Test 4: Weekly Plan Content Variety
\echo '\n4. Testing content variety and distribution...'
SELECT 
  wp.content_type,
  COUNT(*) as post_count,
  array_agg(DISTINCT wp.platform) as platforms,
  AVG(LENGTH(wp.caption)) as avg_caption_length,
  MIN(wp.post_date) as first_post,
  MAX(wp.post_date) as last_post
FROM weekly_posts wp
JOIN weekly_content_plans wcp ON wp.plan_id = wcp.id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
GROUP BY wp.content_type
ORDER BY post_count DESC;

-- Test 5: Optimal Timing Distribution (Layer 6 → Layer 9)
\echo '\n5. Testing optimal posting times...'
SELECT 
  EXTRACT(DOW FROM wp.post_date) as day_of_week,
  wp.optimal_posting_time as posting_hour,
  COUNT(*) as scheduled_posts,
  array_agg(DISTINCT wp.content_type) as content_types
FROM weekly_posts wp
JOIN weekly_content_plans wcp ON wp.plan_id = wcp.id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
GROUP BY day_of_week, posting_hour
ORDER BY day_of_week, posting_hour;

-- Test 6: Caption Quality Metrics (Layer 8 Output)
\echo '\n6. Testing AI caption quality metrics...'
SELECT 
  wp.platform,
  COUNT(*) as total_captions,
  MIN(LENGTH(wp.caption)) as min_length,
  MAX(LENGTH(wp.caption)) as max_length,
  AVG(LENGTH(wp.caption))::int as avg_length,
  MIN(array_length(wp.hashtags, 1)) as min_hashtags,
  MAX(array_length(wp.hashtags, 1)) as max_hashtags,
  AVG(array_length(wp.hashtags, 1))::numeric(4,1) as avg_hashtags,
  AVG(wp.emoji_count)::numeric(4,1) as avg_emojis
FROM weekly_posts wp
JOIN weekly_content_plans wcp ON wp.plan_id = wcp.id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
  AND wp.caption IS NOT NULL
GROUP BY wp.platform;

-- Test 7: Temporal Context Integration (Layer 3 → Layer 9)
\echo '\n7. Testing temporal context in final output...'
SELECT 
  wp.post_date,
  CASE EXTRACT(DOW FROM wp.post_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  CASE 
    WHEN EXTRACT(MONTH FROM wp.post_date) IN (12, 1, 2) THEN 'winter'
    WHEN EXTRACT(MONTH FROM wp.post_date) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM wp.post_date) IN (6, 7, 8) THEN 'summer'
    ELSE 'fall'
  END as season,
  wp.content_type,
  wp.platform,
  LEFT(wp.caption, 80) || '...' as caption_preview
FROM weekly_posts wp
JOIN weekly_content_plans wcp ON wp.plan_id = wcp.id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
ORDER BY wp.post_date
LIMIT 7;

-- Test 8: Plan Completeness Check
\echo '\n8. Testing weekly plan completeness...'
SELECT 
  wcp.id as plan_id,
  wcp.week_start_date,
  wcp.week_number,
  COUNT(wp.id) as total_posts,
  COUNT(CASE WHEN wp.status = 'scheduled' THEN 1 END) as scheduled,
  COUNT(CASE WHEN wp.status = 'draft' THEN 1 END) as draft,
  COUNT(CASE WHEN wp.caption IS NOT NULL THEN 1 END) as has_caption,
  COUNT(CASE WHEN array_length(wp.hashtags, 1) >= 5 THEN 1 END) as has_hashtags,
  COUNT(CASE WHEN wp.image_url IS NOT NULL THEN 1 END) as has_image,
  CASE 
    WHEN COUNT(wp.id) >= 3 AND 
         COUNT(CASE WHEN wp.caption IS NOT NULL THEN 1 END) = COUNT(wp.id) THEN 'complete'
    WHEN COUNT(wp.id) > 0 THEN 'partial'
    ELSE 'empty'
  END as completeness_status
FROM weekly_content_plans wcp
LEFT JOIN weekly_posts wp ON wcp.id = wp.plan_id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
GROUP BY wcp.id, wcp.week_start_date, wcp.week_number
ORDER BY wcp.week_start_date DESC
LIMIT 3;

-- Test 9: Export Format Readiness (JSON structure)
\echo '\n9. Testing JSON export format...'
SELECT 
  jsonb_build_object(
    'plan_id', wcp.id,
    'business_name', b.business_name,
    'week_start', wcp.week_start_date,
    'status', wcp.status,
    'posts', jsonb_agg(
      jsonb_build_object(
        'date', wp.post_date,
        'platform', wp.platform,
        'content_type', wp.content_type,
        'caption', wp.caption,
        'hashtags', wp.hashtags,
        'emoji_count', wp.emoji_count,
        'posting_time', wp.optimal_posting_time,
        'image_url', wp.image_url
      ) ORDER BY wp.post_date
    )
  ) as weekly_plan_json
FROM weekly_content_plans wcp
JOIN businesses b ON wcp.business_id = b.id
LEFT JOIN weekly_posts wp ON wcp.id = wp.plan_id
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.status = 'active'
GROUP BY wcp.id, b.business_name, wcp.week_start_date, wcp.status
LIMIT 1;

\echo '\n=== LAYER 9 TEST COMPLETE ==='
\echo 'Verify all data flows correctly from Layers 1-8 into final weekly plan output\n'
