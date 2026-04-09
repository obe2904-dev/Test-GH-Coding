-- =====================================================
-- LAYER 8: AI CAPTION GENERATOR VERIFICATION
-- =====================================================
-- Purpose: Verify AI-generated captions (Gemini 2.5 Flash)
-- Test Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- Date: 2026-01-30

-- LAYER 8 RESPONSIBILITIES:
-- 1. Generate captions with Gemini 2.5 Flash (temperature 0.5)
-- 2. Target brevity: 125-200 characters
-- 3. Match brand voice (friendly, welcoming, warm)
-- 4. Include quality score (0-100)
-- 5. Smart emoji usage (moderate frequency for cafe)
-- 6. Smart summarization for long menu descriptions (>100 chars)
-- 7. Generate first line preview (125 chars)

-- CONTEXT: Layer 8 was fixed earlier in conversation for:
-- - Caption saving bug (removed .success wrapper)
-- - Quality score tracking
-- - Emoji counting
-- - Temperature reduced from 0.7 to 0.5
-- Now verifying these fixes are working

-- =====================================================
-- Q1: Check caption structure in weekly plans
-- =====================================================
SELECT 
    p->'postType'->>'type' as content_type,
    p->'contentSubject'->>'dish' as subject,
    p->'caption'->>'text' as caption_text,
    LENGTH(p->'caption'->>'text') as char_count,
    p->'caption'->>'quality_score' as quality_score,
    p->'caption'->>'emoji_count' as emoji_count
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
ORDER BY p->'timing'->>'day';

-- =====================================================
-- Q2: Check brevity compliance (125-200 char target)
-- =====================================================
SELECT 
    CASE 
        WHEN LENGTH(p->'caption'->>'text') < 125 THEN 'Too short (<125)'
        WHEN LENGTH(p->'caption'->>'text') BETWEEN 125 AND 200 THEN 'Target range (125-200)'
        WHEN LENGTH(p->'caption'->>'text') BETWEEN 201 AND 250 THEN 'Slightly long (201-250)'
        ELSE 'Too long (>250)'
    END as length_category,
    COUNT(*) as count,
    ROUND(AVG(LENGTH(p->'caption'->>'text'))) as avg_chars
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
GROUP BY length_category
ORDER BY length_category;

-- =====================================================
-- Q3: Check quality scores are saved
-- =====================================================
SELECT 
    p->'postType'->>'type' as content_type,
    (p->'caption'->>'quality_score')::int as quality_score,
    COUNT(*) as count
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND p->'caption'->>'quality_score' IS NOT NULL
GROUP BY content_type, quality_score
ORDER BY content_type, quality_score DESC;

-- =====================================================
-- Q4: Check emoji usage patterns
-- =====================================================
SELECT 
    (p->'caption'->>'emoji_count')::int as emoji_count,
    COUNT(*) as posts_with_count,
    json_agg(DISTINCT p->'postType'->>'type') as content_types
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
GROUP BY emoji_count
ORDER BY emoji_count;

-- =====================================================
-- Q5: Check for hallucination (captions mention non-existent items)
-- =====================================================
-- Verify post subjects exist in actual menu
SELECT DISTINCT
    p->'contentSubject'->>'dish' as subject,
    p->'postType'->>'type' as content_type
FROM weekly_content_plans wcp,
     jsonb_array_elements(wcp.posts) as p
WHERE wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND p->'postType'->>'type' = 'menu_item'
ORDER BY subject;

-- =====================================================
-- Q6: Verify first line preview generation
-- =====================================================
SELECT 
    p->'contentSubject'->>'dish' as subject,
    LEFT(p->'caption'->>'text', 125) as first_line,
    LENGTH(LEFT(p->'caption'->>'text', 125)) as preview_length
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  );

-- =====================================================
-- Q7: Check brand voice alignment (tone keywords)
-- =====================================================
-- Expected: Café Faust has ["friendly", "welcoming", "warm"]
SELECT 
    bbp.tone_keywords as brand_tone,
    p->'postType'->>'type' as content_type,
    p->'caption'->>'text' as caption_sample
FROM business_brand_profile bbp,
     weekly_content_plans wcp,
     jsonb_array_elements(wcp.posts) as p
WHERE bbp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND wcp.created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
LIMIT 2;

-- =====================================================
-- Q8: Check menu item descriptions from menu_results_v2
-- =====================================================
-- See which menu items have long descriptions that need summarization
SELECT 
    item->>'name' as item_name,
    LENGTH(item->>'description') as desc_length,
    CASE 
        WHEN LENGTH(item->>'description') > 100 THEN '✅ Needs summarization'
        WHEN LENGTH(item->>'description') BETWEEN 50 AND 100 THEN 'Medium length'
        ELSE 'Short'
    END as length_category,
    LEFT(item->>'description', 80) as description_preview
FROM menu_results_v2 m,
     jsonb_array_elements(m.structured_data->'menus') as menu,
     jsonb_array_elements(menu->'items') as item
WHERE m.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND item->>'name' IN ('FAVORITTEN', 'DEN NYE', 'Pandekage')
ORDER BY desc_length DESC;


-- =====================================================
-- RESULTS FROM EXECUTION:
-- =====================================================

-- Q1 Results:
-- ❌ CRITICAL: quality_score is NULL for all posts
-- ❌ CRITICAL: emoji_count is NULL for all posts
-- ⚠️ LANGUAGE INCONSISTENCY:
--    - "FAVORITTEN" and "DEN NYE": English template ("Is it just us or does...")
--    - "Pandekage" and atmosphere: Proper Danish
-- ⚠️ BREVITY ISSUES:
--    - Pandekage: 224 chars (target is 125-200)
--    - Atmosphere: 188 chars (within target)
--    - FAVORITTEN: 117 chars (too short)
--    - DEN NYE: 117 chars (too short)

-- Q2 Results:
-- ❌ BREVITY TARGET MISSED:
--    - Too short (<125): 30 posts (50%)
--    - Target range (125-200): 4 posts (6.7%) ⚠️
--    - Slightly long (201-250): 13 posts (21.7%)
--    - Too long (>250): 13 posts (21.7%)
--    - Average: 109, 168, 218, 513 chars respectively
-- CRITICAL: Only 6.7% of posts meet target brevity
-- CRITICAL: 13 posts are >250 chars (AI ignoring instructions)

-- Q3 Results:
-- ❌ NO QUALITY SCORES SAVED
-- Zero posts have quality_score populated
-- Earlier fix didn't work or wasn't deployed

-- Q4 Results:
-- ❌ NO EMOJI COUNTS SAVED
-- All 60 posts have emoji_count = null
-- Earlier fix didn't work or wasn't deployed

-- Q5 Results:
-- ✅ NO HALLUCINATION: All menu items are real
--    - DEN NYE (menu_item)
--    - FAVORITTEN (menu_item)
--    - Pandekage (menu_item)
-- These match menu items from Layer 1 verification

-- Q6 Results:
-- ⚠️ FIRST LINE PREVIEW ISSUES:
--    - FAVORITTEN/DEN NYE: 117 chars (entire caption, not truncated)
--    - Pandekage/Atmosphere: 125 chars (properly truncated)
-- NOTE: Short captions (<125) return full text, which is fine

-- Q7 Results:
-- ✅ Brand tone correct: ["friendly", "welcoming", "warm"]
-- ❌ LANGUAGE MISMATCH: Captions in English, not Danish
--    - "Is it just us or does favoritten look amazing?"
--    - Should be: "Er det kun os, eller ser FAVORITTEN fantastisk ud?"
-- CRITICAL: Template fallback being used instead of AI generation

-- Q8 Results:
-- ⚠️ NO ROWS RETURNED: None of the posted items found by exact name match
-- This suggests either:
--    1. Case sensitivity issues (FAVORITTEN vs Favoritten)
--    2. Menu extraction stores names differently than posts reference them
--    3. Query needs fuzzy matching
-- NOTE: Layer 1 verified 73 items exist, so data is there but names don't match exactly


-- =====================================================
-- LAYER 8 ANALYSIS:
-- =====================================================

-- FINDINGS:
-- ❌ Captions generating - MIXED RESULTS
--    - Some captions are proper Danish (Pandekage, atmosphere)
--    - Some use English template fallback (FAVORITTEN, DEN NYE)
--    - Template: "Is it just us or does [item] look amazing?"

-- ❌ Brevity requirements - FAILING
--    - Target: 125-200 characters
--    - Actual: Only 6.7% (4/60 posts) meet target
--    - 50% too short (<125 chars, avg 109)
--    - 21.7% too long (>250 chars, avg 513)
--    - 21.7% slightly long (201-250 chars, avg 218)

-- ❌ Quality scores - NOT SAVED
--    - All posts have quality_score = null
--    - Earlier fix not working or not deployed

-- ❌ Emoji counts - NOT TRACKED
--    - All posts have emoji_count = null
--    - Earlier fix not working or not deployed

-- ✅ No hallucination - WORKING
--    - All menu items are real (DEN NYE, FAVORITTEN, Pandekage)
--    - Match items from Layer 1 verification

-- ✅ First line preview - WORKING
--    - Captions <125 chars return full text (correct behavior)
--    - Captions >125 chars truncated to 125 (correct behavior)

-- ❌ Brand voice alignment - BROKEN
--    - Brand tone correct: ["friendly", "welcoming", "warm"]
--    - Brand tone correct: ["friendly", "welcoming", "warm"]
--    - Language WRONG: Some captions in English, should be Danish
--    - Country is "DK" (Denmark), captions should be Danish

-- ⚠️ Smart summarization - CANNOT VERIFY
--    - Q8 couldn't match posted items to menu descriptions
--    - Suggests name mismatch between menu data and posts

-- BUGS FOUND:
-- 1. ❌ CRITICAL: quality_score and emoji_count not being saved
--    - Both fields are null for all 60 posts
--    - Earlier fixes (lines 533-535 in weekly-plan-generator.ts) not working
--    - Need to verify fix was deployed

-- 2. ❌ CRITICAL: Template fallback instead of AI generation
--    - FAVORITTEN and DEN NYE use English template:
--      "Is it just us or does [item] look amazing? [ITEM] is ready..."
--    - Should be AI-generated Danish captions
--    - Suggests AI generation failing silently, falling back to template

-- 3. ❌ HIGH: Language mismatch (English vs Danish)
--    - Business country is "DK" (Denmark)
--    - Some captions in English (FAVORITTEN, DEN NYE)
--    - Some captions in Danish (Pandekage, atmosphere)
--    - Inconsistent language selection

-- 4. ❌ HIGH: Brevity target missed (93.3% failure rate)
--    - Target: 125-200 chars
--    - Only 4/60 posts (6.7%) meet target
--    - Half are too short (avg 109 chars)
--    - Quarter are way too long (>250 chars, avg 513!)
--    - AI ignoring brevity instructions

-- 5. ⚠️ MEDIUM: Menu item name mismatch
--    - Posts reference items by name (FAVORITTEN, DEN NYE, Pandekage)
--    - Q8 can't find exact matches in menu_results_v2
--    - Suggests naming inconsistency between layers

-- DESIGN OBSERVATIONS:
-- 1. Template fallback exists but shouldn't be triggered
-- 2. AI temperature 0.5 not helping with brevity
-- 3. Language detection may not be working (should use country="DK" → Danish)
-- 4. Quality score and emoji count tracking infrastructure exists but not populating
-- 5. Some captions ARE properly generated (Pandekage, atmosphere) but others fail

-- LAYER 8 STATUS: ⚠️ PARTIALLY BROKEN
-- - Caption generation: ⚠️ Mixed (some AI, some template fallback)
-- - Brevity compliance: ❌ Failing (93.3% miss target)
-- - Quality scores: ❌ Not saved
-- - Emoji tracking: ❌ Not saved
-- - Language: ❌ Inconsistent (English/Danish mix)
-- - Hallucination: ✅ Working (no fake items)
-- - First line preview: ✅ Working
-- BUGS FOUND:
-- 1. ❌ CRITICAL: quality_score and emoji_count not being saved
--    - Both fields are null for all 60 posts
--    - Earlier fixes (lines 533-535 in weekly-plan-generator.ts) not working
--    - Need to verify fix was deployed

-- 2. ❌ CRITICAL: Template fallback instead of AI generation
--    - FAVORITTEN and DEN NYE use English template:
--      "Is it just us or does [item] look amazing? [ITEM] is ready..."
--    - Should be AI-generated Danish captions
--    - Suggests AI generation failing silently, falling back to template

-- 3. ❌ HIGH: Language mismatch (English vs Danish)
--    - Business country is "DK" (Denmark)
--    - Some captions in English (FAVORITTEN, DEN NYE)
--    - Some captions in Danish (Pandekage, atmosphere)
--    - Inconsistent language selection

-- 4. ❌ HIGH: Brevity target missed (93.3% failure rate)
--    - Target: 125-200 chars
--    - Only 4/60 posts (6.7%) meet target
--    - Half are too short (avg 109 chars)
--    - Quarter are way too long (>250 chars, avg 513!)
--    - AI ignoring brevity instructions

-- 5. ⚠️ MEDIUM: Menu item name mismatch
--    - Posts reference items by name (FAVORITTEN, DEN NYE, Pandekage)
--    - Q8 can't find exact matches in menu_results_v2
--    - Suggests naming inconsistency between layers

-- DESIGN OBSERVATIONS:
-- 1. Template fallback exists but shouldn't be triggered
-- 2. AI temperature 0.5 not helping with brevity
-- 3. Language detection may not be working (should use country="DK" → Danish)
-- 4. Quality score and emoji count tracking infrastructure exists but not populating
-- 5. Some captions ARE properly generated (Pandekage, atmosphere) but others fail

-- LAYER 8 STATUS: ⚠️ PARTIALLY BROKEN
-- - Caption generation: ⚠️ Mixed (some AI, some template fallback)
-- - Brevity compliance: ❌ Failing (93.3% miss target)
-- - Quality scores: ❌ Not saved
-- - Emoji tracking: ❌ Not saved
-- - Language: ❌ Inconsistent (English/Danish mix)
-- - Hallucination: ✅ Working (no fake items)
-- - First line preview: ✅ Working
