#!/bin/bash
# Check brand-profile-generator function logs for recent errors

echo "Fetching recent brand-profile-generator logs..."
echo "Looking for Café Faust business_id: f4679fa9-3120-4a59-9506-d059b010c34a"
echo ""

# Get logs from last 30 minutes
supabase functions logs brand-profile-generator \
  --project-ref kvqdkohdpvmdylqgujpn \
  --tail 100

echo ""
echo "Check for:"
echo "  - Stage PS log entries"
echo "  - goal_blend generation"
echo "  - Error messages"
echo "  - HTTP status codes"
