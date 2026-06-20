#!/bin/bash

# Test: Verify decision_timing logic fix for mixed booking+walk-in businesses
# Expected: Brunch should be "mixed" (not "spontaneous") when high competition + accepts both

BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00"

echo "=== STEP 1: Check current booking settings ==="
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_operations?business_id=eq.$BUSINESS_ID&select=reservation_required,accepts_walkins" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq .

echo -e "\n=== STEP 2: Check current decision_timing (before fix) ==="
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_programme_profiles?business_id=eq.$BUSINESS_ID&select=programme_name,decision_timing,baseline_goal_split&order=created_at.desc&limit=5" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq .

echo -e "\n=== STEP 3: Deploy V5 generator with fix ==="
cd "$(dirname "$0")"
supabase functions deploy brand-profile-generator-v5 --no-verify-jwt

echo -e "\n=== STEP 4: Regenerate brand profile ==="
curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data "{\"business_id\":\"$BUSINESS_ID\"}" \
  | jq '.programmes[] | {programme: .programme_name, decision_timing: .decision_timing, goal_split: .baseline_goal_split}'

echo -e "\n=== STEP 5: Verify decision_timing (after fix) ==="
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_programme_profiles?business_id=eq.$BUSINESS_ID&select=programme_name,decision_timing,baseline_goal_split&order=created_at.desc&limit=5" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq .

echo -e "\n=== EXPECTED RESULT ==="
echo "Brunch: decision_timing should be 'mixed' (not 'spontaneous_walk_in')"
echo "Reasoning: High competition (16 competitors) + accepts both booking and walk-in"
echo "→ Bookings SECURE customers from going to competitors"
