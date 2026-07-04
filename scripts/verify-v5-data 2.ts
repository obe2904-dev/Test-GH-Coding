// Verify V5 profile data in database
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/verify-v5-data.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

const testBusinessId = '840347de-9ba7-4275-8aa3-4553417fc2af';

console.log('🔍 Verifying V5 profile data in database\n');
console.log(`Business ID: ${testBusinessId}\n`);

// Check business_programme_profiles
console.log('1️⃣  Checking business_programme_profiles table...');
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('*')
  .eq('business_id', testBusinessId);

if (progError) {
  console.error('❌ Error querying business_programme_profiles:', progError);
} else if (!programmes || programmes.length === 0) {
  console.log('⚠️  No programme profiles found');
} else {
  console.log(`✅ Found ${programmes.length} programme profile(s):\n`);
  programmes.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.programme_name} (${p.programme_type})`);
    console.log(`      Time: ${p.time_windows?.[0] || 'N/A'}`);
    console.log(`      Decision Timing: ${p.decision_timing || 'N/A'}`);
    console.log(`      Confidence: ${p.confidence || 'N/A'}`);
    console.log(`      Audience Segments: ${p.audience_segments?.length || 0}`);
    if (p.audience_segments && p.audience_segments.length > 0) {
      p.audience_segments.forEach((seg: any) => {
        console.log(`         • ${seg.label} (${seg.segment_size})`);
      });
    }
    console.log('');
  });
}

// Check business_brand_profile.positioning
console.log('\n2️⃣  Checking business_brand_profile.positioning column...');
const { data: brandProfile, error: brandError } = await supabase
  .from('business_brand_profile')
  .select('positioning, brand_essence, tone_of_voice')
  .eq('business_id', testBusinessId)
  .single();

if (brandError) {
  console.error('❌ Error querying business_brand_profile:', brandError);
} else if (!brandProfile) {
  console.log('⚠️  No brand profile found');
} else {
  console.log('✅ Brand profile found:');
  console.log(`   Positioning: ${brandProfile.positioning ? brandProfile.positioning.slice(0, 100) + '...' : 'NULL'}`);
  console.log(`   Brand Essence: ${brandProfile.brand_essence ? brandProfile.brand_essence.slice(0, 100) + '...' : 'NULL'}`);
  console.log(`   Tone of Voice: ${brandProfile.tone_of_voice ? brandProfile.tone_of_voice.slice(0, 100) + '...' : 'NULL'}`);
}

console.log('\n\n✅ VERIFICATION COMPLETE');
console.log('📍 View in dashboard: http://localhost:3000/dashboard/brand');
