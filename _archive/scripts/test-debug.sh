#!/bin/bash
# Debug: Check exactly what we're sending

echo "Paste your AUTH_TOKEN:"
read AUTH_TOKEN
echo ""

STRATEGY_ID="a542058e-1787-44d5-8a90-12f345b75899"

echo "📤 Sending request with strategy_id: $STRATEGY_ID"
echo ""

curl -v -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\": \"2026-02-17\", \"strategy_id\": \"${STRATEGY_ID}\"}" \
  2>&1 | grep -E "strategy_id|strategyId|POST|< HTTP"

echo ""
echo "Check Supabase logs now"
