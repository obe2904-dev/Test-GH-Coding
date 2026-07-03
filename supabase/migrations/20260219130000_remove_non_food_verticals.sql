-- Migration: Remove Non-Food & Beverage Verticals
-- Platform is 100% focused on food & beverage businesses only
-- Date: 2026-02-19

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: Convert any non-food verticals to default (cafe)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.businesses
SET vertical = 'cafe'
WHERE vertical NOT IN ('cafe', 'restaurant', 'bar', 'bakery', 'food_truck');

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: Update CHECK constraint to only allow food & beverage verticals
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing constraint
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_vertical_check;

-- Add new CHECK constraint with ONLY food & beverage verticals
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_vertical_check
  CHECK (vertical IN (
    'cafe', 
    'restaurant', 
    'bar', 
    'bakery', 
    'food_truck'
  ));

COMMENT ON CONSTRAINT businesses_vertical_check ON public.businesses IS 
'Platform is focused exclusively on food & beverage businesses. Separate platforms exist for beauty, fitness, retail, and professional services.';
