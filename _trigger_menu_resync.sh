#!/bin/bash

# Trigger menu-sync to reclassify existing menu items
# This will apply new drinks/coffee category detection to existing data

SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1MzkxNTQsImV4cCI6MjA0ODExNTE1NH0.2c7hiBf0n0RhH0D9YLIp5R_PHvYXn0q6EYUlxIoT-tc"
BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"

echo "🔄 Re-syncing menu items for Cafe Faust..."
echo "This will reclassify COCKTAILS/APÉRITIF as 'drinks' instead of 'main'"
echo ""

curl -X POST \
  "${SUPABASE_URL}/functions/v1/menu-sync" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"${BUSINESS_ID}\",
    \"forceResync\": true
  }"

echo ""
echo ""
echo "✅ Menu sync triggered!"
echo "Check menu_items_normalized for updated category_type values."
