#!/bin/bash
# Deploy updated brand-profile-generator-v5 with Tone DNA support
# This uploads the modified TypeScript files to Supabase

echo "🚀 Deploying brand-profile-generator-v5 Edge Function..."
echo "   This includes:"
echo "   - Tone DNA generation (Layer 5.5)"
echo "   - Enhanced examples with reasoning"
echo "   - Programme-aware example coverage"
echo "   - Location vs demographic separation"
echo ""

cd supabase/functions

# Deploy the function
supabase functions deploy brand-profile-generator-v5

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next step: Regenerate Café Faust profile again in the UI"
echo "Expected result: Tone DNA + Enhanced Examples will be generated"
