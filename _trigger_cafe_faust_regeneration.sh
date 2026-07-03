#!/bin/bash
# Trigger Café Faust Brand Profile V5 Regeneration with Tone DNA
# This will generate Layer 5.5 Tone DNA + enhanced examples

BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"
SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
FUNCTION_NAME="brand-profile-generator-v5"

# Get Supabase anon key from environment or .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🚀 Regenerating Café Faust Brand Profile V5..."
echo "   Business ID: $BUSINESS_ID"
echo "   Expected: Tone DNA + Enhanced Examples"
echo ""

# Call edge function
curl -X POST \
  "$SUPABASE_URL/functions/v1/$FUNCTION_NAME" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"businessId\": \"$BUSINESS_ID\"}" \
  | jq '.'

echo ""
echo "✅ Regeneration complete!"
echo ""
echo "Run verification queries in _regenerate_cafe_faust_with_tone_dna.sql to check results"
