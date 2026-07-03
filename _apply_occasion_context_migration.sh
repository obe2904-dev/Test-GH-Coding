#!/bin/bash

# Apply occasion_context migration
echo "🚀 Applying occasion_context migration..."

# Read environment variables
set -a
source .env
set +a

# Apply migration using psql
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "$SUPABASE_DB_HOST" -U postgres -d postgres -f supabase/migrations/20260613000001_add_occasion_context.sql

echo "✅ Migration applied successfully"
