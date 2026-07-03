#!/bin/bash
# Apply brand profile schema migration using direct connection

echo "🔧 Applying brand profile schema migration..."
echo ""

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json 2>/dev/null | jq -r '.[] | select(.name=="service_role") | .api_key')

if [ -z "$SERVICE_KEY" ]; then
  echo "❌ Could not retrieve service role key"
  echo ""
  echo "Please apply the migration manually in Supabase SQL Editor:"
  echo "1. Go to https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql"
  echo "2. Open _FIX_BRAND_PROFILE_SCHEMA.sql"
  echo "3. Copy and paste the contents"
  echo "4. Click 'Run'"
  exit 1
fi

# Execute migration
psql "postgresql://postgres.kvqdkohdpvmdylqgujpn:${SERVICE_KEY}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f "_FIX_BRAND_PROFILE_SCHEMA.sql"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
else
  echo ""
  echo "❌ Migration failed. Please run manually in Supabase SQL Editor."
fi
