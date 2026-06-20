#!/bin/bash
# Test: Generate a post and verify forbidden phrases are blocked

SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMDM1NjYsImV4cCI6MjA0Mzg3OTU2Nn0.FYY0MBvtTz2NwvNkSK1e_cGfJG63q1_aAdTk0f1jy_8"
BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"

echo "=== Testing Forbidden Phrases Enforcement ==="
echo "Business: Cafe Faust"
echo ""

# First, get a menu suggestion from week 24
echo "1. Fetching test suggestion..."
SUGGESTION=$(curl -s "${SUPABASE_URL}/rest/v1/weekly_content_suggestions?business_id=eq.${BUSINESS_ID}&week_number=eq.24&content_type=eq.menu_item&limit=1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" | jq '.[0]')

if [ "$SUGGESTION" == "null" ]; then
  echo "❌ No suggestions found"
  exit 1
fi

TITLE=$(echo "$SUGGESTION" | jq -r '.title')
echo "✅ Found: $TITLE"
echo ""

# Generate text from this suggestion
echo "2. Generating post text..."
RESULT=$(curl -s "${SUPABASE_URL}/functions/v1/generate-text-from-idea" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"${BUSINESS_ID}\",
    \"suggestion\": ${SUGGESTION},
    \"platforms\": [\"facebook\"],
    \"tier\": \"paid\"
  }")

echo "$RESULT" | jq '.'
echo ""
echo "3. Check function logs:"
echo "https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions/generate-text-from-idea/logs"
