#!/bin/bash

# Test Weather Integration in Post Idea Generator
# Tests the new weather API functionality

set -e

echo "🧪 Testing Weather Integration in Post Idea Generator"
echo "=================================================="
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check for required variables
if [ -z "$VIGGO_BIZ_ID" ]; then
  echo "❌ Error: VIGGO_BIZ_ID not set"
  echo "   Set it with: export VIGGO_BIZ_ID='your-business-id'"
  exit 1
fi

SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII"

echo "📋 Test Configuration:"
echo "   Business ID: $VIGGO_BIZ_ID"
echo "   API URL: $SUPABASE_URL"
echo ""

# Test 1: Basic post generation with weather
echo "Test 1: Generate post ideas with weather context"
echo "-------------------------------------------------"

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/post-idea-generator" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"${VIGGO_BIZ_ID}\"
  }")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if weather was included
if echo "$RESPONSE" | jq -e '.context.weather' > /dev/null 2>&1; then
  echo ""
  echo "✅ Weather data present in context"
  echo ""
  echo "Weather details:"
  echo "$RESPONSE" | jq -r '.context.weather // "No weather data"'
else
  echo ""
  echo "⚠️  Weather data not present (might be expected if OPENWEATHERMAP_API_KEY not configured)"
fi

echo ""
echo "Generated ideas:"
echo "$RESPONSE" | jq -r '.ideas[] | "- \(.angle)"' 2>/dev/null || echo "No ideas in response"

echo ""
echo "=================================================="
echo "✅ Weather integration test complete!"
echo ""
echo "Next steps:"
echo "1. Configure OPENWEATHERMAP_API_KEY in Supabase Edge Function secrets"
echo "2. Verify weather data appears in post ideas"
echo "3. Check Supabase logs for weather fetch attempts"
