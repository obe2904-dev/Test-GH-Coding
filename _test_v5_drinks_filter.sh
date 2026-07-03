#!/bin/bash
# =====================================================
# TEST V5 DRINKS FILTER
# Tests brand profile generation with drinks filtering
# Date: 2. juni 2026
# =====================================================

BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"
SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00"

echo "=========================================="
echo "🧪 TESTING V5 BRAND PROFILE GENERATOR"
echo "=========================================="
echo ""
echo "Business: Cafe Faust"
echo "Expected: AFTEN/Cocktails programme EXCLUDED"
echo ""

# Run V5 generator
echo "📡 Calling brand-profile-generator-v5..."
echo ""

curl -X POST \
  "${SUPABASE_URL}/functions/v1/brand-profile-generator-v5" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"businessId\": \"${BUSINESS_ID}\", \"forceRegenerate\": true}" \
  | jq '.'

echo ""
echo "=========================================="
echo "✅ Check the 'programmes' array above"
echo "=========================================="
echo ""
echo "Expected programmes:"
echo "  ✅ lunch (FROKOST)"
echo "  ✅ morning (Brunch)" 
echo "  ❌ AFTEN (should be EXCLUDED)"
echo "  ❌ MENUKORT/bar (should be EXCLUDED)"
echo ""
