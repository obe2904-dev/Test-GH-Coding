// Generate V5 profile for the business the user is logged in with
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/generate-v5-for-my-business.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  Deno.exit(1);
}

// This is the business ID from your console logs
const yourBusinessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

console.log('🚀 Generating V5 Brand Profile for YOUR Business\n');
console.log(`📍 Business ID: ${yourBusinessId}`);
console.log(`🔗 Endpoint: ${supabaseUrl}/functions/v1/brand-profile-generator-v5\n`);

const startTime = Date.now();

try {
  console.log('⏳ Calling V5 Edge Function...');
  console.log('   This may take 60-90 seconds (4 layers, multiple AI calls)\n');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/brand-profile-generator-v5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: yourBusinessId,
        forceRegenerate: true
      })
    }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Function failed (${response.status}) after ${duration}s:`);
    console.error(errorText);
    Deno.exit(1);
  }

  const result = await response.json();

  console.log(`✅ Function completed successfully in ${duration}s\n`);
  console.log('📊 RESULTS:\n');
  console.log(`Business: ${result.business?.name || 'Unknown'}`);
  console.log(`Request ID: ${result.requestId}`);
  console.log(`Duration: ${result.durationMs}ms\n`);

  console.log('🎯 IDENTITY (Layer 3):');
  console.log(`Brand Essence: ${result.identity?.brand_essence || 'N/A'}`);
  console.log(`Positioning: ${result.identity?.positioning || 'N/A'}`);
  console.log(`Confidence: ${result.identity?.confidence || 'N/A'}\n`);

  console.log(`🎪 PROGRAMMES (${result.programmes?.length || 0} detected):`);
  result.programmes?.forEach((p: any, i: number) => {
    console.log(`\n${i + 1}. ${p.name} (${p.type})`);
    console.log(`   Time: ${p.timeWindow?.start}-${p.timeWindow?.end}`);
    console.log(`   Decision Timing: ${p.commercialOrientation?.decision_timing}`);
    console.log(`   Goal Split: Footfall ${p.commercialOrientation?.baseline_goal_split?.drive_footfall}%, Brand ${p.commercialOrientation?.baseline_goal_split?.strengthen_brand}%, Regulars ${p.commercialOrientation?.baseline_goal_split?.retain_regulars}%`);
    console.log(`   Audience Segments: ${p.audienceSegments || 0}`);
  });

  console.log('\n\n✅ V5 BRAND PROFILE GENERATION COMPLETE!');
  console.log('\n📍 Refresh your browser at http://localhost:3000/dashboard/brand to see the results!');

} catch (error) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`\n❌ Error after ${duration}s:`);
  console.error(error);
  Deno.exit(1);
}
