#!/bin/bash

# Configuration
BUSINESS_ID="YOUR_BUSINESS_ID_HERE"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"
PDF_URL="https://example.com/menu.pdf"  # Use actual PDF URL

SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/extract-menu-pdf"

echo "🚀 Starting menu extraction test..."
echo "Business ID: $BUSINESS_ID"
echo "Function: $FUNCTION_URL"
echo ""

# Call extract function
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"pdfUrl\": \"$PDF_URL\"
  }")

echo "Response:"
echo "$RESPONSE" | jq .

# Extract result ID
RESULT_ID=$(echo "$RESPONSE" | jq -r '.resultId')

if [ "$RESULT_ID" != "null" ] && [ -n "$RESULT_ID" ]; then
  echo ""
  echo "✅ Job queued! Result ID: $RESULT_ID"
  echo ""
  echo "Check status with:"
  echo "SELECT status, confidence_score, processing_time_ms FROM menu_results WHERE id = '$RESULT_ID';"
  echo ""
  echo "View results with:"
  echo "SELECT structured_data FROM menu_results WHERE id = '$RESULT_ID';"
else
  echo "❌ Failed to queue job"
fi
