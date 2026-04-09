#!/bin/bash

# Fix Conflicting Guidance in typical_openings and typical_closings
# Remove generic terms that are also in the banned list

SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json 2>/dev/null | jq -r '.[] | select(.name=="service_role") | .api_key')
BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"
API_URL="https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1"

echo "======================================================================"
echo "Fixing Conflicting Guidance in Café Faust Brand Profile"
echo "======================================================================"
echo ""

# Current conflicting examples:
# typical_openings: "Kom forbi til...", "Nyd en stund ved åen..."
# typical_closings: "Kom forbi"
#
# These conflict with banned words: "kom forbi", "nyd"

echo "1. Removing conflicting examples from typical_openings..."
echo "   Removing: 'Kom forbi til...', 'Nyd en stund ved åen...'"
echo "   Keeping: 'Café i Aarhus...', 'Cafe Faust byder på...'"
echo ""

NEW_OPENINGS='[
  "Café i Aarhus...",
  "Cafe Faust byder på..."
]'

echo "2. Removing conflicting examples from typical_closings..."
echo "   Removing: 'Kom forbi'"
echo "   Keeping: 'Vi ses ☕', 'Velkommen', 'Vi ses på Åboulevarden'"
echo ""

NEW_CLOSINGS='[
  "Vi ses ☕",
  "Velkommen",
  "Vi ses på Åboulevarden"
]'

echo "3. Updating database..."
UPDATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/business_brand_profile?business_id=eq.${BUSINESS_ID}" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"typical_openings\": ${NEW_OPENINGS}, \"typical_closings\": ${NEW_CLOSINGS}, \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")

if [ $? -eq 0 ]; then
  echo "   ✓ Database updated successfully"
else
  echo "   ✗ Database update failed"
  exit 1
fi
echo ""

echo "4. Verifying changes..."
VERIFICATION=$(curl -s "${API_URL}/business_brand_profile?business_id=eq.${BUSINESS_ID}&select=typical_openings,typical_closings" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}")

echo "   typical_openings:"
echo "$VERIFICATION" | jq -r '.[0].typical_openings[]' | nl
echo ""
echo "   typical_closings:"
echo "$VERIFICATION" | jq -r '.[0].typical_closings[]' | nl

echo ""
echo "======================================================================"
echo "DONE ✓"
echo "======================================================================"
echo ""
echo "Next: Redeploy and test captions should no longer contain:"
echo "  - 'kom forbi' (removed from closings & openings)"
echo "  - 'nyd' (removed from openings)"
