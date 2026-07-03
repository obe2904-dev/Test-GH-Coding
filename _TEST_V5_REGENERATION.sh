#!/bin/bash
# ============================================================================
# TEST V5 BRAND PROFILE REGENERATION
# ============================================================================
# Business ID: f4679fa9-3120-4a59-9506-d059b010c34a (Café Faust)
# Issue: After regenerating, UI shows same as before
# ============================================================================

BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"
SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"

# Get service role key from environment or .env file
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not set in environment"
  echo "Trying to load from .env file..."
  
  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
  else
    echo "❌ .env file not found. Please set SUPABASE_SERVICE_ROLE_KEY"
    exit 1
  fi
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY still not set. Exiting."
  exit 1
fi

echo "============================================================================"
echo "TESTING V5 BRAND PROFILE REGENERATION"
echo "============================================================================"
echo "Business ID: $BUSINESS_ID"
echo "Supabase URL: $SUPABASE_URL"
echo ""

# Step 1: Call menu-overview-summary
echo "📊 Step 1: Generating menu overview summary..."
echo ""

MENU_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/menu-overview-summary" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"businessId\": \"${BUSINESS_ID}\"}")

echo "Response:"
echo "$MENU_RESPONSE" | jq '.' 2>/dev/null || echo "$MENU_RESPONSE"
echo ""
echo "---"
echo ""

# Small delay to ensure database write completes
sleep 2

# Step 2: Call brand-profile-generator-v5
echo "🎯 Step 2: Generating V5 brand profile (forceRegenerate=true)..."
echo ""

V5_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/brand-profile-generator-v5" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"businessId\": \"${BUSINESS_ID}\", \"forceRegenerate\": true}")

echo "Response:"
echo "$V5_RESPONSE" | jq '.' 2>/dev/null || echo "$V5_RESPONSE"
echo ""

# Check if successful
if echo "$V5_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo "✅ V5 profile generation successful!"
  
  # Extract key metrics
  PROGRAMMES=$(echo "$V5_RESPONSE" | jq '.programmes | length')
  DURATION=$(echo "$V5_RESPONSE" | jq '.durationMs')
  
  echo ""
  echo "Summary:"
  echo "  - Programmes generated: $PROGRAMMES"
  echo "  - Generation time: ${DURATION}ms"
  echo ""
else
  echo "❌ V5 profile generation failed!"
  
  # Check for specific error messages
  if echo "$V5_RESPONSE" | jq -e '.existing == true' > /dev/null 2>&1; then
    echo "⚠️  Profile already exists (forceRegenerate might not be working)"
  fi
  
  if echo "$V5_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$V5_RESPONSE" | jq -r '.error')
    echo "Error: $ERROR_MSG"
  fi
fi

echo ""
echo "============================================================================"
echo "NEXT STEPS:"
echo "============================================================================"
echo "1. Run _CHECK_BRAND_PROFILE_STATUS.sql in Supabase to verify data"
echo "2. Check http://localhost:3000/dashboard/brand to see if UI updates"
echo "3. Clear browser cache if data looks correct but UI doesn't update"
echo "============================================================================"
