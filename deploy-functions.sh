#!/bin/bash
# Deploy Supabase Edge Functions

echo "🚀 Deploying Supabase Edge Functions..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Project not linked. Linking to project..."
    supabase link --project-ref kvqdkohdpvmdylqgujpn
fi

# Deploy ai-generate function
echo "📦 Deploying ai-generate function..."
supabase functions deploy ai-generate --project-ref kvqdkohdpvmdylqgujpn

# Deploy analyze-website function
echo "📦 Deploying analyze-website function..."
supabase functions deploy analyze-website --project-ref kvqdkohdpvmdylqgujpn

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure OPENAI_API_KEY is set in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/settings/functions"
echo ""
echo "2. Or set via CLI:"
echo "   supabase secrets set OPENAI_API_KEY=your-key-here --project-ref kvqdkohdpvmdylqgujpn"
echo ""
echo "3. Run database migration:"
echo "   Run supabase/migrations/002_business_profiles.sql in SQL Editor"
echo ""
