#!/bin/bash
# Test Path B: Legacy Flow (Layer 1-9 without Layer 0 strategy)

echo "🧪 Test Path B: Legacy Plan Generation (No Strategy)"
echo ""

# Auto-fetch service_role key from Supabase
echo "📡 Fetching service_role key from Supabase..."
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep service_role | awk '{print $3}')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Failed to fetch service_role key. Please run 'supabase login' first."
  exit 1
fi

echo "✅ Service key retrieved"
echo ""
echo "Paste your BUSINESS_ID and press Enter:"
read BUSINESS_ID
echo ""

# Generate plan WITHOUT strategy_id (legacy path)
echo "📝 Generating weekly plan without strategy (Path B - Legacy)..."
PLAN_RESPONSE=$(curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\": \"2026-02-24\", \"business_id\": \"${BUSINESS_ID}\", \"regenerate\": true}")

# Show raw response
echo "📦 Raw API Response:"
echo "$PLAN_RESPONSE" | jq '.'
echo ""

# Extract key fields
echo "📊 Extracted Fields:"
echo "$PLAN_RESPONSE" | jq '{
  success,
  strategyId: .plan.strategyId,
  strategyNarrative: .plan.strategyNarrative,
  postCount: (.plan.posts | length),
  firstPost: {
    dish: .plan.posts[0].contentSubject.dish,
    selectionRationale: .plan.posts[0].selectionRationale,
    hasStrategicContext: (.plan.posts[0].strategicContext != null)
  }
}'
echo ""

# Verification
SUCCESS=$(echo "$PLAN_RESPONSE" | jq -r '.success // null')
STRATEGY_ID=$(echo "$PLAN_RESPONSE" | jq -r '.plan.strategyId // null')
POST_COUNT=$(echo "$PLAN_RESPONSE" | jq -r '.plan.posts | length // 0')

echo "🔍 Verification Checklist:"
if [ "$SUCCESS" = "true" ]; then
  echo "  [✓] success = true"
else
  echo "  [ ] success = true (got: $SUCCESS)"
fi

if [ "$STRATEGY_ID" = "null" ]; then
  echo "  [✓] strategyId = null (as expected for Path B)"
else
  echo "  [!] strategyId should be null but got: $STRATEGY_ID"
fi

if [ "$POST_COUNT" -ge 5 ]; then
  echo "  [✓] postCount >= 5 (got: $POST_COUNT)"
else
  echo "  [ ] postCount >= 5 (got: $POST_COUNT)"
fi

# Check that posts were generated via legacy scoring
SELECTION_METHOD=$(echo "$PLAN_RESPONSE" | jq -r '.plan.posts[0].selectionRationale // ""')
if echo "$SELECTION_METHOD" | grep -qi "strategisk valgt"; then
  echo "  [!] WARNING: First post appears to use strategy (should be legacy scoring)"
else
  echo "  [✓] Posts generated via legacy scoring method"
fi

echo ""
echo "✅ If all above are present, Path B (Legacy flow) still works!"
echo ""
echo "🔑 Key Difference from Path A:"
echo "   • Path A: Uses Layer 0 strategy → strategyId present, strategicContext filled"
echo "   • Path B: Uses Layer 5 scoring → strategyId null, no strategicContext"
