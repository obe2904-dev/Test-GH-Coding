#!/bin/bash
# Layer 0 Integration Test Script
# Run these tests to verify the dual-path architecture

# ============================================================================
# SETUP: Get your credentials first
# ============================================================================

# 1. Get your auth token from browser:
#    - Open http://localhost:3000
#    - Login
#    - Open DevTools → Application → Local Storage → supabase.auth.token
#    - Copy the access_token value

# 2. Get your business_id:
#    - Supabase Dashboard → Table Editor → businesses → copy your ID

# Set these variables:
AUTH_TOKEN="YOUR_ACCESS_TOKEN_HERE"
BUSINESS_ID="YOUR_BUSINESS_ID_HERE"
SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"

# ============================================================================
# TEST 2: LEGACY PATH (Test this first - verifies nothing broke)
# ============================================================================

echo "🧪 TEST 2: Legacy Path (no strategy)"
echo "Generating weekly plan the old way (Layer 5 → Layer 6-8)..."

curl -X POST "${SUPABASE_URL}/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "weekStart": "2026-02-17"
  }' | jq '.'

echo ""
echo "✅ Check above output:"
echo "   - Should return success: true"
echo "   - Should have posts array"
echo "   - Check Supabase logs for 'Calling selectWeeklyOpportunities'"
echo ""
read -p "Press Enter to continue to Test 1..."

# ============================================================================
# TEST 1: LAYER 0 INTEGRATION (New functionality)
# ============================================================================

echo ""
echo "🧪 TEST 1: Layer 0 Integration"
echo ""

# Step 1: Generate strategy
echo "Step 1: Generating Layer 0 strategy..."
STRATEGY_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"business_id\": \"${BUSINESS_ID}\",
    \"week_start\": \"2026-02-17\"
  }")

echo "$STRATEGY_RESPONSE" | jq '.'

# Extract strategy ID
STRATEGY_ID=$(echo "$STRATEGY_RESPONSE" | jq -r '.strategy_id // .id')

if [ "$STRATEGY_ID" = "null" ] || [ -z "$STRATEGY_ID" ]; then
  echo "❌ ERROR: Failed to get strategy_id from response"
  echo "Response was: $STRATEGY_RESPONSE"
  exit 1
fi

echo ""
echo "✅ Strategy generated! ID: $STRATEGY_ID"
echo ""
read -p "Press Enter to generate full posts from this strategy..."

# Step 2: Generate full plan from strategy
echo ""
echo "Step 2: Generating full posts from strategy (Layer 0 → Layer 1-9)..."

curl -X POST "${SUPABASE_URL}/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"weekStart\": \"2026-02-17\",
    \"strategy_id\": \"${STRATEGY_ID}\"
  }" | jq '.'

echo ""
echo "✅ Check above output:"
echo "   - Should return success: true"
echo "   - Should have strategyNarrative"
echo "   - Posts should match strategy's suggested_media types"
echo "   - Check Supabase logs for 'Using Layer 0 strategy'"
echo ""

# ============================================================================
# VERIFICATION QUERIES
# ============================================================================

echo ""
echo "📊 Run these queries in Supabase Dashboard to verify:"
echo ""
echo "1. Check strategy status updated to 'planned':"
echo "   SELECT id, status, selected_idea_ids FROM weekly_strategies WHERE id = '${STRATEGY_ID}';"
echo ""
echo "2. Check content plan linked to strategy:"
echo "   SELECT id, strategy_id, strategy_narrative FROM weekly_content_plans WHERE strategy_id = '${STRATEGY_ID}';"
echo ""
echo "3. Verify new metadata columns:"
echo "   SELECT platforms, subscription_tier, target_post_count FROM weekly_strategies WHERE id = '${STRATEGY_ID}';"
echo ""
