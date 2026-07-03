-- Migration: Two-Dimensional Content Framework
-- Replaces three-goal system (footfall/brand/loyalty) with tactical CTA + content style
-- Author: System
-- Date: 2026-06-29

-- ============================================================
-- PART 1: Update business_brand_profile.content_strategy
-- ============================================================

COMMENT ON COLUMN business_brand_profile.content_strategy IS 
'Two-dimensional content framework:
{
  "tactical_capabilities": { "booking": boolean, "footfall": boolean },
  "tactical_focus": "drive_bookings" | "drive_footfall",
  "content_balance": { "performance_driven": 0-100, "brand_building": 0-100 },
  "brand_maturity": "new" | "growing" | "established" | "premium",
  "market_position": "leader" | "challenger" | "specialist",
  "content_category_weights": { "team_people": number, "product_menu": number, "behind_scenes": number, "craving_visual": number },
  "goal_blend": { ... } -- DEPRECATED - kept for rollback safety
}';

-- ============================================================
-- PART 2: Data Migration - Add New Fields to Existing Records
-- ============================================================

-- Update existing businesses with new two-dimensional structure
-- This preserves existing goal_blend for rollback safety
UPDATE business_brand_profile
SET content_strategy = COALESCE(content_strategy, '{}'::jsonb) || jsonb_build_object(
  'tactical_capabilities', jsonb_build_object(
    'booking', EXISTS(
      SELECT 1 FROM businesses 
      WHERE id = business_brand_profile.business_id 
        AND booking_url IS NOT NULL
    ),
    'footfall', TRUE  -- Assume all can accept footfall unless proven otherwise via business_operations
  ),
  'tactical_focus', CASE 
    WHEN (content_strategy->'goal_blend'->>'drive_footfall')::int > 
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
-- PART 3: Add content_style to posts table
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
-- PART 4: Validation Query
-- ============================================================

-- Verify migration success
DO $$
DECLARE
  businesses_updated INTEGER;
  businesses_with_capabilities INTEGER;
  businesses_with_balance INTEGER;
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
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Businesses with tactical_capabilities: %', businesses_with_capabilities;
  RAISE NOTICE '  - Businesses with content_balance: %', businesses_with_balance;
  RAISE NOTICE '  - Posts table content_style column added';
  
  IF businesses_with_capabilities = 0 THEN
    RAISE WARNING 'No businesses were migrated - check data';
  END IF;
END $$;
