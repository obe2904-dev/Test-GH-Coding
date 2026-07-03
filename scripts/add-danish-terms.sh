#!/bin/bash

# Add Missing Danish Generic Terms to Café Faust never_say Array
# This will update the never_say field by adding critical missing Danish terms

SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json 2>/dev/null | jq -r '.[] | select(.name=="service_role") | .api_key')
BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"
API_URL="https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1"

echo "=========================================="
echo "Adding Missing Danish Generic Terms"
echo "=========================================="
echo ""

# Step 1: Fetch current never_say array
echo "1. Fetching current never_say array..."
CURRENT_DATA=$(curl -s "${API_URL}/business_brand_profile?business_id=eq.${BUSINESS_ID}&select=never_say" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}")

CURRENT_COUNT=$(echo "$CURRENT_DATA" | jq -r '.[0].never_say | length')
echo "   Current count: ${CURRENT_COUNT} words"
echo ""

# Step 2: Define new Danish generic terms
NEW_TERMS='[
  "kom forbi",
  "kom indenfor",
  "kom og nyd",
  "kom forbi og nyd",
  "kom og smag",
  "nyd",
  "nyd en kop",
  "nyd vores",
  "nyd måltidet",
  "kaffepause",
  "hyggelig stemning",
  "hyggelig café",
  "hyggeligt sted",
  "dejlig kaffe",
  "fantastisk mad",
  "vidunderlig",
  "amazing",
  "perfekt til",
  "til enhver lejlighed",
  "perfekt start på dagen",
  "når du har brug for",
  "i hjertet af",
  "midt i byen",
  "bedste kaffe",
  "bedste brunch",
  "højeste kvalitet",
  "velkommen til",
  "vi glæder os til",
  "vi ser frem til"
]'

echo "2. Merging with new Danish terms..."
NEW_COUNT=$(echo "$NEW_TERMS" | jq '. | length')
echo "   Adding: ${NEW_COUNT} new terms"
echo ""

# Step 3: Merge and deduplicate
MERGED=$(echo "$CURRENT_DATA" | jq -r --argjson new "$NEW_TERMS" '
  .[0].never_say + $new | unique
')

MERGED_COUNT=$(echo "$MERGED" | jq '. | length')
echo "3. After merge and deduplication:"
echo "   ${CURRENT_COUNT} original + ${NEW_COUNT} new = ${MERGED_COUNT} total (after dedup)"
echo ""

# Step 4: Update database
echo "4. Updating database..."
UPDATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/business_brand_profile?business_id=eq.${BUSINESS_ID}" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"never_say\": ${MERGED}, \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")

if [ $? -eq 0 ]; then
  echo "   ✓ Database updated successfully"
else
  echo "   ✗ Database update failed"
  exit 1
fi
echo ""

# Step 5: Verify critical terms are present
echo "5. Verifying critical Danish terms..."
VERIFICATION=$(curl -s "${API_URL}/business_brand_profile?business_id=eq.${BUSINESS_ID}&select=never_say" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}")

check_term() {
  local term="$1"
  if echo "$VERIFICATION" | jq -e --arg term "$term" '.[0].never_say | index($term)' > /dev/null 2>&1; then
    echo "   ✓ \"$term\" is present"
  else
    echo "   ✗ \"$term\" is MISSING"
  fi
}

check_term "kom forbi"
check_term "nyd"
check_term "kaffepause"
check_term "hyggelig stemning"

echo ""
echo "=========================================="
echo "Danish Content Sample (first 15):"
echo "=========================================="
echo "$VERIFICATION" | jq -r '.[0].never_say[] | select(test("[æøåÆØÅ]"))' | head -15 | nl

echo ""
echo "=========================================="
echo "DONE ✓"
echo "=========================================="
echo ""
echo "Next step: Run verification script"
echo "  bash scripts/verify-database-v17.sh"
