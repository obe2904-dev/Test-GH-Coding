#!/bin/bash
# Apply onboarding migration to Supabase

echo "📋 Onboarding Migration SQL"
echo "============================"
echo ""
echo "To apply this migration:"
echo "1. Go to your Supabase Dashboard"
echo "2. Click 'SQL Editor' in the left sidebar"
echo "3. Click 'New Query'"
echo "4. Copy and paste the SQL below:"
echo ""
cat supabase/migrations/008_onboarding_function.sql
echo ""
echo "5. Click 'Run' to execute"
echo ""
echo "✅ This will create the update_profile_onboarding function"
