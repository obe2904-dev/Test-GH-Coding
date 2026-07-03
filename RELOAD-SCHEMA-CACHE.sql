-- Run this in Supabase Dashboard > SQL Editor to reload the schema cache
-- This will make PostgREST recognize the establishment_type column

NOTIFY pgrst, 'reload schema';

-- Done! The menu extraction should work now.
