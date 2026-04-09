#!/bin/bash
# Test Hybrid Solution with Thinking Mode

echo "🧪 Testing Hybrid Solution with Thinking Mode"
echo "=============================================="

# Get service key
SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json | jq -r '.[] | select(.name=="service_role") | .api_key')

# Test week (current week)
WEEK_START="2026-02-17"

echo ""
echo "📅 Testing week: $WEEK_START"
echo "🏢 Business: Café Faust"
echo ""
echo "Generating strategy (this will take ~20-25 seconds with thinking mode)..."
echo ""

# Make request
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"business_id\":\"840347de-9ba7-4275-8aa3-4553417fc2af\",\"week_start\":\"$WEEK_START\",\"regenerate\":true}" \
  -o /tmp/hybrid-test.json

# Check if successful
if [ $? -eq 0 ]; then
  echo "✅ API call completed"
  echo ""
  echo "📊 RESULTS:"
  echo "=========="
  
  # Extract key metrics
  jq '{
    success: .success,
    strategy_id: .strategy_id,
    post_count: (.strategy.post_ideas|length),
    has_context_summary: (.strategy.narrative.context_summary != null),
    has_strategy_reasoning: (.strategy.narrative.strategy_reasoning != null),
    context_factors_count: (.strategy.narrative.context_summary.key_factors|length // 0),
    primary_angle: (.strategy.narrative.strategy_reasoning.primary_angle // "N/A"),
    detailed_sections_keys: (.strategy.narrative.detailed_sections|keys)
  }' /tmp/hybrid-test.json
  
  echo ""
  echo "📝 CONTEXT SUMMARY SAMPLE:"
  echo "========================="
  jq '.strategy.narrative.context_summary.key_factors[0]' /tmp/hybrid-test.json
  
  echo ""
  echo "🎯 STRATEGY REASONING SAMPLE:"
  echo "============================"
  jq '.strategy.narrative.strategy_reasoning.reasoning_chain[0]' /tmp/hybrid-test.json
  
  echo ""
  echo "Full output saved to: /tmp/hybrid-test.json"
else
  echo "❌ API call failed"
  cat /tmp/hybrid-test.json
fi
