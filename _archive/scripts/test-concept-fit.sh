#!/bin/bash

# Test Concept Fit Analysis System
# This script tests the analyze-concept-fit edge function

echo "🧪 Testing Concept Fit Analysis System"
echo "========================================"
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if we have required variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
  exit 1
fi

# Step 1: Get a business with location intelligence
echo "📍 Step 1: Finding a business with location intelligence..."
BUSINESS_QUERY=$(cat <<EOF
SELECT 
  b.id,
  b.name,
  bli.area_type,
  bli.category_scores
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE bli.area_type IS NOT NULL
  AND bli.category_scores IS NOT NULL
LIMIT 1;
EOF
)

# You'll need to run this query manually in Supabase SQL Editor to get a business_id
echo ""
echo "Run this query in Supabase SQL Editor to get a test business_id:"
echo "================================================================"
echo "$BUSINESS_QUERY"
echo ""
echo "Then set it below:"
echo ""

# Replace with an actual business_id from your database
BUSINESS_ID="YOUR_BUSINESS_ID_HERE"

if [ "$BUSINESS_ID" = "YOUR_BUSINESS_ID_HERE" ]; then
  echo "⚠️  Please edit this script and set BUSINESS_ID to a real UUID"
  echo ""
  echo "Alternative: Run the edge function directly with curl:"
  echo ""
  echo "curl -X POST \"${SUPABASE_URL}/functions/v1/analyze-concept-fit\" \\"
  echo "  -H \"Authorization: Bearer ${SUPABASE_ANON_KEY}\" \\"
  echo "  -H \"Content-Type: application/json\" \\"
  echo "  -d '{\"business_id\": \"YOUR_BUSINESS_ID\"}'"
  echo ""
  exit 0
fi

# Step 2: Call the edge function
echo "🤖 Step 2: Calling analyze-concept-fit edge function..."
echo ""

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/analyze-concept-fit" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"business_id\": \"${BUSINESS_ID}\"}")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Step 3: Check the database
echo "📊 Step 3: Checking database for results..."
echo ""
echo "Run this query in Supabase SQL Editor:"
echo "======================================"
echo "SELECT 
  business_id,
  overall_fit_level,
  overall_fit_score,
  customer_fit,
  motivation_fit,
  pace_fit,
  price_fit,
  winning_angles_fit,
  strategy_approach,
  strategy_positioning,
  detected_motivations,
  analyzed_for_location_type,
  analyzed_at
FROM business_concept_fit
WHERE business_id = '${BUSINESS_ID}';"
echo ""

echo "✅ Test complete!"
