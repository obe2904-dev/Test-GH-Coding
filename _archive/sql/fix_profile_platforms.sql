-- Check current platform selection
SELECT id, email, selected_platforms 
FROM auth.users 
LEFT JOIN profiles ON auth.users.id = profiles.id 
LIMIT 1;

-- Update to enable both Facebook and Instagram
UPDATE profiles 
SET selected_platforms = '["facebook", "instagram"]'::jsonb
WHERE id = (SELECT id FROM auth.users LIMIT 1);

-- Verify the update
SELECT id, selected_platforms 
FROM profiles 
WHERE id = (SELECT id FROM auth.users LIMIT 1);
