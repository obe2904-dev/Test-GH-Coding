-- CRITICAL FIX: Run this in Supabase SQL Editor to restore login functionality
-- This adds the offerings_full column AND ensures auth trigger exists

-- 1. Add offerings_full column (for explainability feature)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS offerings_full JSONB;
COMMENT ON COLUMN business_brand_profile.offerings_full IS 'All core offering candidates, scores, and evidence for explainability.';

-- 2. Ensure the handle_new_user function exists (CRITICAL for login)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger (CRITICAL for login)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify it worked
SELECT 'SUCCESS: Auth trigger and offerings_full column are now in place' AS status;
