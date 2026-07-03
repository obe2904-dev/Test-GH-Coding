-- =====================================================
-- ADD BUSINESS CAPABILITIES COLUMNS
-- =====================================================
-- Adds simple, structured capability fields to the `businesses` table
-- so UIs and analysis can reliably read/write things like table seating
-- and available menu types.

ALTER TABLE IF EXISTS public.businesses
ADD COLUMN IF NOT EXISTS has_table_seating BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS menus TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS service_model TEXT,
ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.businesses.has_table_seating IS 'Whether the business offers table seating (true/false)';
COMMENT ON COLUMN public.businesses.menus IS 'Array of menu types available (e.g. ["food","drinks","coffee","snacks"])';
COMMENT ON COLUMN public.businesses.service_model IS 'Short service model identifier (e.g. full_service, limited_service, counter, delivery)';
COMMENT ON COLUMN public.businesses.capabilities IS 'Additional capability tags (e.g. ["outdoor_seating","takeaway","reservations"])';

-- NOTE: This migration intentionally keeps things simple. For more complex
-- capability modeling, consider a separate relation `business_capabilities`.
