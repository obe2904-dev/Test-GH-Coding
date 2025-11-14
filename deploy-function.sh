#!/bin/bash
# Deploy Supabase Edge Function

echo "🚀 Deploying ai-generate function to Supabase..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy the function
supabase functions deploy ai-generate --project-ref kvqdkohdpvmdylqgujpn

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set OPENAI_API_KEY secret in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/settings/functions"
echo ""
echo "2. Or use CLI:"
echo "   supabase secrets set OPENAI_API_KEY=your-key-here --project-ref kvqdkohdpvmdylqgujpn"
echo ""
echo "3. Test with:"
echo "   npm run test:ai-generate"
