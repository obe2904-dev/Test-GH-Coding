#!/bin/bash
# Test Path A: Layer 0 → Layer 1-9 Integration

echo "🧪 Test Path A: Layer 0 Strategy Integration"
echo ""

# Auto-fetch service_role key from Supabase
echo "📡 Fetching service_role key from Supabase..."
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep service_role | awk '{print $3}')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Failed to fetch service_role key. Please run 'supabase login' first."
  exit 1
fi

echo "✅ Service key Retrieved"
echo ""
echo "Paste your BUSINESS_ID and press Enter:"
read BUSINESS_ID
echo ""

# Step 1: Generate Layer 0 strategy
echo "📋 Step 1: Generating Layer 0 strategy..."
STRATEGY_RESPONSE=$(curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"business_id\": \"${BUSINESS_ID}\", \"week_start\": \"2026-02-17\"}")

echo "$STRATEGY_RESPONSE" | jq '.'
echo ""

# Extract strategy_id (top-level field, not nested in .strategy)
STRATEGY_ID=$(echo "$STRATEGY_RESPONSE" | jq -r '.strategy_id')

if [ "$STRATEGY_ID" = "null" ] || [ -z "$STRATEGY_ID" ]; then
  echo "❌ Failed to generate strategy. Check response above."
  exit 1
fi

echo "✅ Strategy generated! ID: $STRATEGY_ID"
echo ""

# Step 2: Generate full plan using strategy
echo "📝 Step 2: Generating full posts from strategy..."
PLAN_RESPONSE=$(curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\": \"2026-02-17\", \"business_id\": \"${BUSINESS_ID}\", \"strategy_id\": \"${STRATEGY_ID}\", \"regenerate\": true}")

# Show raw response first to catch any errors
echo ""
echo "📦 Raw API Response:"
echo "$PLAN_RESPONSE" | jq '.'
echo ""

echo "📊 Extracted Fields:"
echo "$PLAN_RESPONSE" | jq '{
  success: .success,
  strategyId: .plan.strategyId,
  strategyNarrative: .plan.strategyNarrative,
  postCount: (.plan.posts | length),
  firstPost: {
    dish: .plan.posts[0].contentSubject.dish,
    format: .plan.posts[0].format,
    strategicContext: .plan.posts[0].strategicContext
  }
}'

echo ""
echo "🔍 Verification Checklist:"
echo "  [ ] success = true"
echo "  [ ] strategyId = $STRATEGY_ID"
echo "  [ ] strategyNarrative exists (not null)"
echo "  [ ] firstPost.strategicContext exists"
echo "  [ ] firstPost.strategicContext.cta_intent exists"
echo "  [ ] firstPost.strategicContext.suggested_media exists"
echo ""
echo "✅ If all above are present, Path A (Layer 0 integration) works!"
