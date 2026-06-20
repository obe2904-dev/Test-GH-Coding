-- Add restaurant_bar to existing business_archetype_enum
-- This type represents: Full-service restaurant with late-night bar component

DO $$ 
BEGIN
  -- Check if the value already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'restaurant_bar' 
    AND enumtypid = 'business_archetype_enum'::regtype
  ) THEN
    -- Add the new value after cafe_bar
    ALTER TYPE business_archetype_enum ADD VALUE 'restaurant_bar' AFTER 'cafe_bar';
  END IF;
END $$;
