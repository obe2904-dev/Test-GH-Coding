#!/bin/bash
# Apply brand profile schema migration

echo "🔧 Applying brand profile schema migration..."

# Read the SQL file and execute via supabase CLI
cat "_FIX_BRAND_PROFILE_SCHEMA.sql" | supabase db execute --linked

echo "✅ Migration complete!"
