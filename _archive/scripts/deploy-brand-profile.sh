#!/bin/bash
# Deploy brand-profile-generator with menu_extractions fallback fix

echo "🚀 Deploying brand-profile-generator..."
echo ""

cd "/Users/olebaek/Test P2G 1"

/opt/homebrew/bin/supabase functions deploy brand-profile-generator --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to Brand Profile page in your app"
    echo "2. Click 'Generer Brand Profil'"
    echo "3. Check Supabase logs for: '✅ Loaded 4 items from menu_extractions table'"
    echo ""
else
    echo ""
    echo "❌ Deployment failed"
    echo "Check https://status.supabase.com/ for Build API status"
    echo ""
fi
