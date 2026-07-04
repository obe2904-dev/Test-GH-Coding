-- =====================================================
-- FIX: Update media_library post_type constraint
-- =====================================================
-- Run this to fix the constraint if migrations didn't apply correctly
-- =====================================================

-- Step 1: Drop ALL existing post_type constraints
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'media_library'::regclass 
        AND conname LIKE '%post_type%'
    LOOP
        EXECUTE format('ALTER TABLE media_library DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

-- Step 2: Update existing data to new categories
UPDATE media_library
SET post_type = CASE
  WHEN post_type = 'menu_item' THEN 'food'
  WHEN post_type = 'behind_the_scenes' THEN 'atmosphere'
  WHEN post_type = 'event' THEN 'atmosphere'
  WHEN post_type = 'other' THEN 'other'
  WHEN post_type = 'branding' THEN 'other'
  WHEN post_type IN ('food', 'drinks', 'atmosphere') THEN post_type -- Already updated
  WHEN post_type IS NULL THEN NULL
  ELSE 'other'
END;

-- Step 3: Add the new constraint
ALTER TABLE media_library 
  ADD CONSTRAINT media_library_post_type_check 
  CHECK (post_type IS NULL OR post_type IN ('food', 'drinks', 'atmosphere', 'other'));

-- Verify the fix
SELECT 
  'Constraint applied successfully' AS status,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'media_library'::regclass
  AND conname = 'media_library_post_type_check';

-- Show current categories
SELECT 
  post_type,
  COUNT(*) as count
FROM media_library
GROUP BY post_type
ORDER BY count DESC;
