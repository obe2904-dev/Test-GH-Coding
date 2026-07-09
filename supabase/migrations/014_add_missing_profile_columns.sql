-- Migration 014: Add Missing Profile Columns
-- Adds business_sector and business_offerings columns that were manually added to profiles table

-- Add business_sector column
-- This is the high-level business category (hospitality, beauty, wellness, retail)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_sector TEXT CHECK (business_sector IN ('hospitality', 'beauty', 'wellness', 'retail'));

-- Add business_offerings column
-- This stores the categorized menu items/services/products in JSONB format
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_offerings JSONB DEFAULT '{
  "categories": []
}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.business_sector IS 'High-level business category: hospitality, beauty, wellness, or retail';
COMMENT ON COLUMN public.profiles.business_offerings IS 'JSONB structure containing categorized offerings: { categories: [{ id, name, items: [{ id, name }] }] }';

-- Create index for business_sector queries
CREATE INDEX IF NOT EXISTS idx_profiles_business_sector ON public.profiles(business_sector);
