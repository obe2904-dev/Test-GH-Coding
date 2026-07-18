-- ============================================================================
-- Add normalized_url to menu_sources for Stable Source Identity
-- Issue: Menu sources are deleted and recreated with new UUIDs
-- Solution: Use normalized URL as stable identity key
-- ============================================================================

-- Add normalized_url column
ALTER TABLE menu_sources 
ADD COLUMN IF NOT EXISTS normalized_url TEXT;

-- Backfill normalized_url for existing records
UPDATE menu_sources
SET normalized_url = LOWER(
  regexp_replace(
    regexp_replace(source_url, '&amp;', '&', 'g'),
    '[?&](w|auto|q|fit|page|fp-x|fp-y|crop|ar)=[^&]*',
    '',
    'g'
  )
)
WHERE normalized_url IS NULL;

-- Make normalized_url NOT NULL after backfill
ALTER TABLE menu_sources 
ALTER COLUMN normalized_url SET NOT NULL;

-- Create unique constraint to prevent duplicate sources per business
ALTER TABLE menu_sources
DROP CONSTRAINT IF EXISTS menu_sources_business_url_unique;

ALTER TABLE menu_sources
ADD CONSTRAINT menu_sources_business_url_unique 
UNIQUE (business_id, normalized_url);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_sources_normalized_url 
ON menu_sources(normalized_url);

-- Add comment
COMMENT ON COLUMN menu_sources.normalized_url IS 
'Normalized URL (lowercased, decoded HTML entities, stripped image params) used as stable identity key per business';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'menu_sources' 
  AND column_name = 'normalized_url';

-- Check for duplicate normalized URLs per business
SELECT business_id, normalized_url, COUNT(*) as count
FROM menu_sources
GROUP BY business_id, normalized_url
HAVING COUNT(*) > 1;

-- Count existing menu sources
SELECT COUNT(*) as total_menu_sources FROM menu_sources;

-- ============================================================================
-- Migration Complete
-- ============================================================================
