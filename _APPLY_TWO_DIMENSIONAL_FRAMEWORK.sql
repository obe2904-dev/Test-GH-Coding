-- Direct application of Two-Dimensional Content Framework
-- Run this manually in Supabase SQL Editor or via psql
-- Date: 2026-06-29

-- ============================================================
-- PART 1: Update business_brand_profile.content_strategy COMMENT
-- ============================================================

COMMENT ON COLUMN business_brand_profile.content_strategy IS 
'Two-dimensional content framework:
{
  "tactical_capabilities": { "booking": boolean, "footfall": boolean },
  "tactical_focus": "drive_bookings" | "drive_footfall",
  "content_balance": { "performance_driven": 0-100, "brand_building": 0-100 },
  "brand_maturity": "new" | "growing" | "established" | "premium",
  "market_position": "leader" | "challenger" | "specialist",
  "content_category_weights": { ... existing ... },
  "goal_blend": { ... } -- DEPRECATED - kept for rollback safety
}';

-- ============================================================
-- PART 2: Add content_style column to posts table
-- ============================================================

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS content_style TEXT 
CHECK (content_style IS NULL OR content_style IN ('performance_driven', 'brand_building', 'balanced'));

COMMENT ON COLUMN public.posts.content_style IS 
'Content strategy dimension: 
- performance_driven: Product focus, urgency, specific offers, "book now" energy
- brand_building: Craft, values, team, process, emotional connection
- balanced: Hybrid approach blending product + story';

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_posts_content_style 
ON public.posts(business_id, content_style) 
WHERE content_style IS NOT NULL;

-- ============================================================
-- PART 3: Update existing business_brand_profile records
-- ============================================================

-- Update existing businesses with new two-dimensional structure
-- This preserves existing goal_blend for rollback safety
UPDATE business_brand_profile
SET content_strategy = COALESCE(content_strategy, '{}'::jsonb) || jsonb_build_object(
  'tactical_capabilities', jsonb_build_object(
    'booking', booking_link IS NOT NULL,
    'footfall', TRUE  -- Assume all can accept footfall unless proven otherwise
  ),
  'tactical_focus', CASE 
    WHEN COALESCE((content_strategy->'goal_blend'->>'drive_footfall')::int, 0) > 
         COALESCE((content_strategy->'goal_blend'->>'build_brand')::int, 0)
    THEN 'drive_footfall'
    ELSE 'drive_bookings'
  END,
  'content_balance', jsonb_build_object(
    'performance_driven', 50,  -- Default 50/50 balanced approach
    'brand_building', 50
  ),
  'brand_maturity', 'established'  -- Conservative default
)
WHERE content_strategy IS NOT NULL;

-- ============================================================
-- PART 4: Validation
-- ============================================================

DO $$
DECLARE
  businesses_updated INTEGER;
  businesses_with_capabilities INTEGER;
  businesses_with_balance INTEGER;
  posts_column_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO businesses_updated
  FROM business_brand_profile
  WHERE content_strategy ? 'tactical_capabilities';
  
  SELECT COUNT(*) INTO businesses_with_capabilities
  FROM business_brand_profile
  WHERE content_strategy->'tactical_capabilities' ? 'booking'
    AND content_strategy->'tactical_capabilities' ? 'footfall';
  
  SELECT COUNT(*) INTO businesses_with_balance
  FROM business_brand_profile
  WHERE content_strategy->'content_balance' ? 'performance_driven'
    AND content_strategy->'content_balance' ? 'brand_building';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'posts' 
      AND column_name = 'content_style'
  ) INTO posts_column_exists;
  
  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE 'Businesses with tactical_capabilities: %', businesses_with_capabilities;
  RAISE NOTICE 'Businesses with content_balance: %', businesses_with_balance;
  RAISE NOTICE 'Posts table content_style column exists: %', posts_column_exists;
  
  IF businesses_with_capabilities = 0 THEN
    RAISE WARNING 'No businesses were migrated - check if content_strategy field exists';
  END IF;
END $$;
