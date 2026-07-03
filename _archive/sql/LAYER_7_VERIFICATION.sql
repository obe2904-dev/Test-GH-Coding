-- =====================================================
-- LAYER 7: MEDIA FORMAT SELECTOR VERIFICATION
-- =====================================================
-- Purpose: Verify photo/video selection and visual direction
-- Test Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- Date: 2026-01-30

-- LAYER 7 RESPONSIBILITIES:
-- 1. Decide photo vs video for each post
-- 2. Generate visual direction (styling, composition)
-- 3. Create production notes for content creators
-- 4. Consider platform preferences (Instagram photo-heavy)
-- 5. Balance format variety across week

-- =====================================================
-- Q1: Check if media format data exists in weekly plans
-- =====================================================
-- Expected: Each post should have platformFormat.format (photo/video)
SELECT 
    id,
    week_start,
    jsonb_array_length(posts) as post_count,
    p->>'platformFormat' as platform_format_raw,
    p->'platformFormat'->>'format' as media_format,
    p->'platformFormat'->>'platform' as platform,
    p->'postType'->>'type' as content_type
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- Q2: Check visual direction structure
-- =====================================================
-- Expected: Each post should have visualDirection with style/composition
SELECT 
    id,
    p->'postType'->>'type' as content_type,
    p->'contentSubject'->>'dish' as subject,
    p->>'visualDirection' as visual_direction_raw,
    p->'visualDirection'->>'style' as style,
    p->'visualDirection'->>'composition' as composition,
    p->'visualDirection'->>'lighting' as lighting
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 4;

-- =====================================================
-- Q3: Check production notes
-- =====================================================
-- Expected: Each post should have productionNotes for creator guidance
SELECT 
    id,
    p->'postType'->>'type' as content_type,
    p->'contentSubject'->>'dish' as subject,
    p->>'productionNotes' as production_notes
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 4;

-- =====================================================
-- Q4: Analyze format distribution across week
-- =====================================================
-- Expected: Mostly photos for cafe (Instagram-optimized)
-- Should see variety in visual styles
SELECT 
    p->'platformFormat'->>'format' as media_format,
    COUNT(*) as count,
    json_agg(DISTINCT p->'postType'->>'type') as content_types
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
GROUP BY p->'platformFormat'->>'format';

-- =====================================================
-- Q5: Check if format varies by content type
-- =====================================================
-- Expected: Different content types might prefer different formats
-- menu_item: usually photo
-- atmosphere: could be photo or video
-- behind_scenes: often video
SELECT 
    p->'postType'->>'type' as content_type,
    p->'platformFormat'->>'format' as media_format,
    COUNT(*) as count
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
GROUP BY p->'postType'->>'type', p->'platformFormat'->>'format'
ORDER BY content_type, media_format;


-- =====================================================
-- RESULTS FROM EXECUTION:
-- =====================================================

-- Q1 Results:
-- ✅ platformFormat exists and is properly structured
-- ✅ All posts are "photo" format (expected for cafe)
-- ✅ All posts are "instagram" platform
-- ✅ formatRationale: "Single image for quick production and clear focus"
-- ✅ platformRationale: "Instagram optimized for visual content"
-- FINDING: No format variety (all photos) - may be intentional for cafe

-- Q2 Results:
-- ✅ visualDirection exists with detailed structure
-- ✅ Has: angle, setting, styling, lighting, technicalSpecs, altText
-- ✅ Technical specs correct: 1080x1080, JPG, RGB, 1:1 aspect ratio
-- ✅ Lighting: "Bright natural daylight, overhead sun, crisp shadows"
-- ✅ Setting: "On restaurant table, restaurant interior"
-- ⚠️ Keys are: angle/setting/styling/lighting (not style/composition/lighting)
-- ⚠️ Some "undefined" values in altText field
-- NOTE: Query looked for wrong keys (style/composition don't exist)

-- Q3 Results:
-- ✅ productionNotes exists
-- ✅ Has: timing (11:00), estimatedTime (10-15 minutes), logistics (empty array)
-- ⚠️ MINIMAL GUIDANCE: No creative direction, no shot requirements, no props
-- OBSERVATION: Just time estimates, not actual production instructions

-- Q4 Results:
-- ✅ Latest week: 4 posts, all photos
-- ✅ Content types: menu_item (3) + atmosphere_experience (1)
-- FINDING: 100% photos (no reels/carousels)

-- Q5 Results:
-- ✅ Across all 60 posts (15 plans × 4 posts):
--    - menu_item: 45 posts, all photos
--    - atmosphere_experience: 15 posts, all photos
-- FINDING: Consistent photo selection for all content types


-- =====================================================
-- Q6: Check visualDirection actual structure (not assumed keys)
-- =====================================================
SELECT 
    p->'postType'->>'type' as content_type,
    p->'contentSubject'->>'dish' as subject,
    p->'visualDirection'->>'angle' as angle,
    p->'visualDirection'->>'setting' as setting,
    p->'visualDirection'->>'styling' as styling,
    p->'visualDirection'->>'lighting' as lighting,
    p->'visualDirection'->'technicalSpecs'->>'aspectRatio' as aspect_ratio
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  );

-- Q6 Results:
-- ❌ IDENTICAL VISUAL DIRECTION FOR ALL POSTS:
--    - Angle: "45-degree angle, balanced composition" (all 4 posts)
--    - Setting: "On restaurant table, restaurant interior" (all 4 posts)
--    - Styling: "Balanced, appetizing color palette" (all 4 posts)
--    - Lighting: "Bright natural daylight, overhead sun, crisp shadows" (all 4 posts)
-- CRITICAL: No differentiation between menu items and atmosphere
-- CRITICAL: Generic fallback values being used, not content-specific

-- =====================================================
-- Q7: Check for "undefined" issues in visual direction
-- =====================================================
SELECT 
    COUNT(*) as posts_with_undefined,
    COUNT(*) FILTER (WHERE p->'visualDirection'->>'altText' LIKE '%undefined%') as alttext_undefined,
    COUNT(*) FILTER (WHERE p->'visualDirection'->>'setting' LIKE '%undefined%') as setting_undefined,
    COUNT(*) FILTER (WHERE p->'visualDirection'->>'styling' LIKE '%undefined%') as styling_undefined
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Q7 Results:
-- ❌ ALL 60 POSTS HAVE "undefined" IN altText
--    - 60/60 posts affected (100%)
--    - setting and styling fields are OK
--    - Example: "undefined setting visible in background, undefined styling"
-- CRITICAL BUG: altText generation broken

-- =====================================================
-- Q8: Check production notes detail level
-- =====================================================
SELECT 
    p->'postType'->>'type' as content_type,
    p->'productionNotes'->>'estimatedTime' as time_estimate,
    jsonb_array_length(p->'productionNotes'->'logistics') as logistics_count,
    p->'productionNotes'->>'timing' as timing
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  );

-- Q8 Results:
-- ⚠️ MINIMAL PRODUCTION GUIDANCE:
--    - estimatedTime: "10-15 minutes" (all posts, generic)
--    - logistics: empty array (0 items) for all posts
--    - timing: "11:00" (just echoes post time)
-- NOT USEFUL: No props, no shot requirements, no styling instructions

-- =====================================================
-- LAYER 7 ANALYSIS:
-- =====================================================

-- FINDINGS:
-- ✅ Media format decision logic: Working correctly
--    - All posts are "photo" format (appropriate for cafe)
--    - Rationale provided: "Single image for quick production and clear focus"
--    - Code follows FORMAT_PREFERENCES (menu_highlight: ['photo', 'reel', 'carousel'])
--    - Photo selected as first preference (fastest production)

-- ✅ Platform-specific optimization: Working correctly
--    - All Instagram (matches selected_platforms)
--    - Correct technical specs: 1080x1080, 1:1, JPG, RGB
--    - Rationale: "Instagram optimized for visual content"

-- ⚠️ Visual direction quality: MIXED
--    - Structure is correct (angle, setting, styling, lighting)
--    - Technical specs accurate (dimensions, aspect ratio, format)
--    - Lighting direction detailed ("Bright natural daylight, overhead sun, crisp shadows")
--    - BUT: Contains "undefined" values in altText
--    - Setting and styling are generic/vague

-- ⚠️ Production notes usefulness: MINIMAL
--    - Only contains: timing (11:00), estimatedTime (10-15 min), logistics (empty)
--    - Missing: Shot requirements, props needed, styling instructions
--    - Missing: Creative direction, setup notes, technical requirements
--    - Not actionable for content creator

-- ℹ️ Format variety across week: ALL PHOTOS (By Design)
--    - 100% photos (0% reels, 0% carousels)
--    - Consistent across all 60 posts analyzed
--    - Expected for cafe category (quick production, Instagram-optimized)
--    - Code supports variety but prefers photos for menu content

-- BUGS FOUND:
-- 1. ❌ CRITICAL: All 60 posts have "undefined" in altText (100% failure rate)
--    - Example: "undefined setting visible in background, undefined styling"
--    - Source: visual-direction-generator.ts lines ~250-280
--    - Cause: Missing context variables not being handled in template string
--    - Impact: Accessibility broken, invalid alt text for screen readers

-- 2. ❌ CRITICAL: Visual direction is identical for ALL posts
--    - Same angle, setting, styling, lighting for every post
--    - No differentiation between FAVORITTEN vs Pandekage vs atmosphere
--    - Suggests visual-direction-generator.ts is using generic fallbacks
--    - Code should generate unique directions based on content subject

-- 3. ⚠️ Production notes too minimal to be useful
--    - Only contains: estimatedTime (generic "10-15 minutes"), timing (post hour), logistics (empty)
--    - Missing: Shot requirements, props needed, lighting setup
--    - Missing: Dish presentation, garnish, background elements
--    - Not actionable for content creator

-- DESIGN OBSERVATIONS:
-- 1. ✅ Layer 7 correctly prioritizes photos for cafe (fast, Instagram-optimized)
-- 2. ✅ Format preferences are sensible (menu → photo first, atmosphere → reel/photo)
-- 3. ✅ No performance data exists, so defaults to first preference (photo)
-- 4. ℹ️ Capacity constraints not tested (no Reel production history)
-- 5. ℹ️ Platform balancing not tested (only Instagram selected)
-- 6. ❌ Visual direction generator runs but produces IDENTICAL generic output for all posts

-- LAYER 7 STATUS: ⚠️ PARTIALLY WORKING
-- - Format selection: ✅ Working
-- - Platform selection: ✅ Working
-- - Visual direction: ❌ Broken (generic/identical output)
-- - Alt text: ❌ Broken (100% have "undefined")
-- - Production notes: ⚠️ Too minimal to be useful
