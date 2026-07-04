#!/bin/bash
# ============================================================================
# DEPLOY MENU OVERVIEW SUMMARY - Edge Functions
# ============================================================================
# Run this script from project root directory
# ============================================================================

set -e  # Exit on error

echo "🚀 Starting Menu Overview Summary Deployment..."
echo ""

# ============================================================================
# Step 1: Navigate to project root
# ============================================================================
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
echo "✅ Current directory: $(pwd)"
echo ""

# ============================================================================
# Step 2: Verify supabase directory exists
# ============================================================================
if [ ! -d "supabase/functions" ]; then
    echo "❌ Error: supabase/functions directory not found!"
    echo "   Make sure you're in the project root directory"
    exit 1
fi
echo "✅ Found supabase/functions directory"
echo ""

# ============================================================================
# Step 3: Deploy menu-overview-summary Edge Function
# ============================================================================
echo "📦 Deploying menu-overview-summary Edge Function..."
supabase functions deploy menu-overview-summary

if [ $? -eq 0 ]; then
    echo "✅ menu-overview-summary deployed successfully"
else
    echo "❌ Failed to deploy menu-overview-summary"
    exit 1
fi
echo ""

# ============================================================================
# Step 4: Deploy brand-profile-generator-v5 Edge Function
# ============================================================================
echo "📦 Deploying brand-profile-generator-v5 Edge Function..."
supabase functions deploy brand-profile-generator-v5

if [ $? -eq 0 ]; then
    echo "✅ brand-profile-generator-v5 deployed successfully"
else
    echo "❌ Failed to deploy brand-profile-generator-v5"
    exit 1
fi
echo ""

# ============================================================================
# Step 5: Summary
# ============================================================================
echo "🎉 Deployment Complete!"
echo ""
echo "Deployed Edge Functions:"
echo "  ✅ menu-overview-summary"
echo "  ✅ brand-profile-generator-v5"
echo ""
echo "Next Steps:"
echo "  1. Run database migration: ADD_MENU_OVERVIEW_SUMMARY_COLUMN.sql"
echo "  2. Update frontend to call both functions sequentially"
echo "  3. Test with Café Faust (business_id: f4679fa9-3120-4a59-9506-d059b010c34a)"
echo ""
echo "📚 Documentation:"
echo "  - CROSS-MENU-SUMMARY-IMPLEMENTATION.md"
echo "  - FRONTEND-INTEGRATION-GUIDE.md"
echo ""
