#!/bin/bash
# Check business data for debugging

BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"

echo "🔍 Checking business data..."
echo ""

# Get service role key
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep service_role | awk '{print $3}')

echo "📋 Businesses table:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/businesses?id=eq.${BUSINESS_ID}&select=id,name,category,vertical" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "📍 Business locations:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_locations?business_id=eq.${BUSINESS_ID}&select=label,address_line1,city,country,is_primary" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "📝 Business profile:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_profile?business_id=eq.${BUSINESS_ID}&select=short_description,long_description" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
