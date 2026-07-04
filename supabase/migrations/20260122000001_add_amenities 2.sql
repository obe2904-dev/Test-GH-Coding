-- Migration: Add WiFi, Power Outlets, and Parking amenities to business_operations
-- Date: 2026-01-22
-- Description: Adds three new boolean fields for common business amenities

-- Add WiFi availability
ALTER TABLE public.business_operations
ADD COLUMN IF NOT EXISTS has_wifi BOOLEAN DEFAULT false;

-- Add power outlets availability  
ALTER TABLE public.business_operations
ADD COLUMN IF NOT EXISTS has_power_outlets BOOLEAN DEFAULT false;

-- Add parking availability
ALTER TABLE public.business_operations
ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.business_operations.has_wifi IS 'Whether the business offers WiFi to customers';
COMMENT ON COLUMN public.business_operations.has_power_outlets IS 'Whether the business has power outlets available for customers';
COMMENT ON COLUMN public.business_operations.has_parking IS 'Whether the business has parking available';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_operations'
AND column_name IN ('has_wifi', 'has_power_outlets', 'has_parking')
ORDER BY column_name;
