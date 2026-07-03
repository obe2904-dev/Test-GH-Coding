-- Add business sector column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_sector TEXT CHECK (business_sector IN ('hospitality', 'beauty', 'wellness', 'retail'));

-- Add comment
COMMENT ON COLUMN public.profiles.business_sector IS 'Business sector: hospitality (Restauration & madsteder), beauty (Skønhed & velvære), wellness (Sundhed & wellness), retail (Butik / detailhandel)';
