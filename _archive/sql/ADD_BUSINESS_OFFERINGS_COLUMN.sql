-- Add business_offerings JSONB column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_offerings JSONB;

-- Add comment
COMMENT ON COLUMN public.profiles.business_offerings IS 'Business offerings/products structured as categories and items (menu, treatments, products, etc.)';
