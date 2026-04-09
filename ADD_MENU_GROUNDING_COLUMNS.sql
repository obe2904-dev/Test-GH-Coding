-- Add menu grounding columns to daily_suggestions
-- These fields persist the dish context so cached suggestions remain text-ready
-- even when the in-memory maps from generation time are no longer available.

ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS menu_item_name        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS menu_item_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS caption_base          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_intent            TEXT NOT NULL DEFAULT 'visit';

COMMENT ON COLUMN public.daily_suggestions.menu_item_name        IS 'Exact menu item name chosen by Gemini (menu_item posts only)';
COMMENT ON COLUMN public.daily_suggestions.menu_item_description IS 'Menu item description from menu_results_v2 at generation time';
COMMENT ON COLUMN public.daily_suggestions.caption_base          IS 'Seed text for caption generation (= item description for menu posts)';
COMMENT ON COLUMN public.daily_suggestions.cta_intent            IS 'Call-to-action intent passed to generate-text-from-idea';
