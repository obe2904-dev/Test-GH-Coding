#!/bin/bash
# Check detailed business context

BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"

echo "🔍 Checking detailed business context..."
echo ""

# Get service role key
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep service_role | awk '{print $3}')

echo "🎨 Brand profile:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.${BUSINESS_ID}&select=business_voice,tone_keywords,voice_style,values" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "📝 Business profile (detailed):"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_profile?business_id=eq.${BUSINESS_ID}&select=target_audience,price_level,menu_description" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "🍽️ Menu items count:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/menu_results_v2?business_id=eq.${BUSINESS_ID}&status=eq.done&select=id,is_signature" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq 'length'

echo ""
echo "🍽️ Menu sample (first item structure):"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/menu_results_v2?business_id=eq.${BUSINESS_ID}&status=eq.done&select=is_signature,service_periods&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
