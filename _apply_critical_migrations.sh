#!/bin/bash
# Apply the 4 critical migrations manually

set -e

# Get DB connection string
DB_URL=$(supabase status 2>/dev/null | grep "DB URL" | awk '{print $3}')

if [ -z "$DB_URL" ]; then
  echo "Error: Could not get DB URL from supabase status"
  echo "Using fallback connection via supabase db reset"
  exit 1
fi

echo "Applying 4 critical migrations..."

# Apply each migration
echo "1/4: add_strategy_id_to_content_plans"
psql "$DB_URL" < supabase/migrations/20260211000003_add_strategy_id_to_content_plans.sql

echo "2/4: drop_unused_tables"
psql "$DB_URL" < supabase/migrations/20260420000007_drop_unused_tables.sql

echo "3/4: canonicalize_programme_names"
psql "$DB_URL" < supabase/migrations/20260501000003_canonicalize_programme_names.sql

echo "4/4: add_local_location_reference_to_onboarding"
psql "$DB_URL" < supabase/migrations/20260519000000_add_local_location_reference_to_onboarding.sql

# Mark migrations as applied in supabase_migrations table
echo "Marking migrations as applied in history..."
psql "$DB_URL" <<EOF
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20260211000003'),
  ('20260420000007'),
  ('20260501000003'),
  ('20260519000000')
ON CONFLICT (version) DO NOTHING;
EOF

echo "✓ All 4 migrations applied successfully"
