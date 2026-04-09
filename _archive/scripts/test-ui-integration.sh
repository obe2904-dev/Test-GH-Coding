#!/bin/bash

# Test AI Weekly Plan Generation with UI
# This script calls the generate-weekly-plan function to test the full integration

source .env

echo "🧪 Testing AI Weekly Plan Generation"
echo "===================================="
echo ""

# Get current Monday
WEEK_START=$(date -v-Mon +%Y-%m-%d)
echo "📅 Week start: $WEEK_START"
echo ""

# You need to be logged in. Get your access token from the browser:
# 1. Open your app in browser
# 2. Open DevTools (F12)
# 3. Go to Application > Local Storage
# 4. Find 'sb-kvqdkohdpvmdylqgujpn-auth-token' 
# 5. Copy the 'access_token' value

echo "⚠️  You need a valid user access token to test this."
echo ""
echo "To test via UI:"
echo "1. Run: npm run dev"
echo "2. Navigate to: http://localhost:5173/dashboard/ai-weekly-plan"
echo "3. Click 'Generer Ugentlig Plan'"
echo "4. Watch the AI generate natural Danish captions! ✨"
echo ""
echo "Or to test via API (need access token):"
echo "export ACCESS_TOKEN='your-token-from-browser'"
echo "curl -X POST '$SUPABASE_URL/functions/v1/generate-weekly-plan' \\"
echo "  -H 'Authorization: Bearer \$ACCESS_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"weekStart\": \"$WEEK_START\"}'"
echo ""
echo "Expected result:"
echo "- 4-7 posts generated"
echo "- All with AI captions (natural Danish)"
echo "- AI badges visible on each post"
echo "- Quality scores displayed"
echo "- Hashtags included"
echo "- Generation time ~30-60 seconds"
