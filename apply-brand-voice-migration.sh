#!/bin/bash

# Apply brand voice and lifecycle columns migration
# This adds the 9 canonical brand variables needed for Brand Profile functionality

echo "🔧 Applying brand voice and lifecycle columns migration..."
echo ""
echo "This will add the following columns to business_brand_profile:"
echo "  - brand_essence"
echo "  - tone_of_voice"
echo "  - things_to_avoid"
echo "  - core_offerings"
echo "  - content_focus"
echo "  - cta_style"
echo "  - communication_goal"
echo "  - image_preferences"
echo "  - last_edited_by"
echo "  - last_edited_at"
echo ""

# Check if Supabase is configured
if [ ! -f "supabase/.env" ] && [ -z "$SUPABASE_DB_URL" ]; then
  echo "⚠️  Supabase not configured. Please run this SQL in your Supabase SQL Editor:"
  echo ""
  cat supabase/migrations/20260106000000_add_brand_voice_and_lifecycle_columns.sql
  echo ""
  echo "Or set SUPABASE_DB_URL environment variable."
  exit 1
fi

# Apply migration using Supabase CLI if available
if command -v supabase &> /dev/null; then
  echo "✅ Applying migration with Supabase CLI..."
  npx supabase db push
else
  echo "⚠️  Supabase CLI not available. Please run this SQL in your Supabase SQL Editor:"
  echo ""
  cat supabase/migrations/20260106000000_add_brand_voice_and_lifecycle_columns.sql
fi
