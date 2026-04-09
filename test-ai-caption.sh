#!/bin/bash

# Test AI Caption Generator
# Tests Layer 8 caption generation with different scenarios

BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"  # Café Faust

# Get Supabase project details
PROJECT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "kvqdkohdpvmdylqgujpn")
ANON_KEY=$(grep SUPABASE_ANON_KEY .env 2>/dev/null | cut -d '=' -f2 || supabase status 2>/dev/null | grep "anon key" | awk '{print $NF}')

echo "🧪 Testing AI Caption Generator (Layer 8)"
echo "=========================================="
echo ""
echo "📋 Setup:"
echo "   Project: $PROJECT_REF"
echo "   Business: Café Faust"
echo ""
echo "⚙️  First, deploy the function:"
echo "   supabase functions deploy test-ai-caption"
echo ""
read -p "Press Enter after deploying the function..."
echo ""

# Function URL
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/test-ai-caption"

# Test Scenario 1: Winter Menu Highlight (Instagram)
echo "📝 Test 1: Winter Menu Highlight (Instagram)"
echo "---------------------------------------------"
curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"testScenario\": \"menu_winter\"
  }" | jq -r '
    if .success then
      "✅ Caption: \(.caption.caption)\n",
      "📱 Platform: \(.caption.metadata.platform)",
      "📊 Stats: \(.caption.metadata.characterCount) chars, \(.caption.metadata.emojiCount) emojis, \(.caption.metadata.hashtagCount) hashtags",
      "🏷️  Hashtags: \(.caption.hashtags | join(", "))"
    else
      "❌ Error: \(.error)"
    end
  '

echo ""
echo "=========================================="
echo ""

# Test Scenario 2: Friday Night Atmosphere
echo "📝 Test 2: Friday Night Atmosphere"
echo "---------------------------------------------"
curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"testScenario\": \"atmosphere_friday\"
  }" | jq -r '
    if .success then
      "✅ Caption: \(.caption.caption)\n",
      "🎯 Tone: \(.caption.metadata.tone)",
      "🏷️  Hashtags: \(.caption.hashtags | join(", "))"
    else
      "❌ Error: \(.error)"
    end
  '

echo ""
echo "=========================================="
echo ""

# Test Scenario 3: Behind the Scenes (Facebook)
echo "📝 Test 3: Behind the Scenes (Facebook)"
echo "---------------------------------------------"
curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"testScenario\": \"behind_scenes_morning\"
  }" | jq -r '
    if .success then
      "✅ Caption: \(.caption.caption)\n",
      "📱 Platform: \(.caption.metadata.platform)",
      "📊 Character count: \(.caption.metadata.characterCount)"
    else
      "❌ Error: \(.error)"
    end
  '

echo ""
echo "=========================================="
echo ""

# Test Scenario 4: Engagement Post
echo "📝 Test 4: Engagement Post (Coffee or Tea)"
echo "---------------------------------------------"
curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"businessId\": \"$BUSINESS_ID\",
    \"testScenario\": \"engagement_coffee\"
  }" | jq -r '
    if .success then
      "✅ Caption: \(.caption.caption)\n",
      "😀 Emojis: \(.caption.emojis | join(" "))",
      "🏷️  Hashtags: \(.caption.hashtags | join(", "))"
    else
      "❌ Error: \(.error)"
    end
  '

echo ""
echo "✅ Testing complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Available test scenarios:"
echo "   • menu_winter - Danish winter stew (Instagram)"
echo "   • atmosphere_friday - Friday night energy"
echo "   • behind_scenes_morning - Morning prep (Facebook)"
echo "   • engagement_coffee - Coffee or tea poll"
echo "   • spring_brunch - Spring brunch special"
echo "   • summer_outdoor - Outdoor seating story"
echo ""
echo "🔧 To test manually:"
echo "curl -X POST '$FUNCTION_URL' \\"
echo "  -H 'Authorization: Bearer \$ANON_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"businessId\": \"$BUSINESS_ID\", \"testScenario\": \"menu_winter\"}'"
