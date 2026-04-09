#!/bin/bash
# Quick manual test - just paste your credentials and run

echo "🧪 Quick Test: Legacy Path (ensures nothing broke)"
echo ""
echo "Paste your AUTH_TOKEN and press Enter:"
read AUTH_TOKEN
echo ""
echo "Paste your BUSINESS_ID and press Enter:"
read BUSINESS_ID
echo ""
echo "Testing legacy path (no strategy)..."
echo ""

curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\": \"2026-02-17\", \"business_id\": \"${BUSINESS_ID}\"}" \
  | jq '.success, .plan.posts[0].contentSubject.dish'

echo ""
echo "✅ If you see 'true' and a dish name above, legacy path works!"
echo ""
