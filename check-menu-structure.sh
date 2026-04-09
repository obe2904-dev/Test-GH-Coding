#!/bin/bash
# Check menu structured data format

BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep service_role | awk '{print $3}')

echo "🍽️ Menu structured data (condensed):"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/menu_results_v2?business_id=eq.${BUSINESS_ID}&status=eq.done&select=is_signature,structured_data&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[0].structured_data | keys'

echo ""
echo "Menu structure exists?"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/menu_results_v2?business_id=eq.${BUSINESS_ID}&status=eq.done&select=structured_data->>menuStructure&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[0] | if . then "YES" else "NO" end'

echo ""
echo "Item count in first menu:"
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/menu_results_v2?business_id=eq.${BUSINESS_ID}&status=eq.done&select=structured_data&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[0].structured_data.menuStructure? | if . then (. | length) else 0 end'
