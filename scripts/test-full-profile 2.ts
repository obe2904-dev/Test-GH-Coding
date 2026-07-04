// Test full 5-layer brand profile generation (Layers 1-4)
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-full-profile.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;
const apiKey = Deno.env.get('OPENAI_API_KEY')!;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('❌ Missing credentials in .env');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Using Café Faust...\n');

// Café Faust from businesses table
const testBusinessId = '840347de-9ba7-4275-8aa3-4553417fc2af';

const { data: testBusiness, error: bizError } = await supabase
  .from('businesses')
  .select('id, name')
  .eq('id', testBusinessId)
  .single();

if (bizError || !testBusiness) {
  console.error('❌ Business not found:', bizError);
  Deno.exit(1);
}

console.log(`✅ Testing with: ${testBusiness.name} (${testBusiness.id})\n`);

console.log('📊 Generating Layers 1-4 brand profile...');
console.log('   This will take ~60-90 seconds\n');

// Import the actual Layer modules
const { generateProgrammeProfiles } = await import('../supabase/functions/_shared/brand-profile/programme-detector.ts');
const { generateCommercialOrientation } = await import('../supabase/functions/_shared/brand-profile/commercial-orientation.ts');
const { generateIdentityProfile } = await import('../supabase/functions/_shared/brand-profile/identity-profile.ts');
const { generateAudienceSegments } = await import('../supabase/functions/_shared/brand-profile/audience-profile.ts');

try {
  // Fetch all required data
  console.log('1️⃣  Fetching business data...');
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', testBusiness.id)
    .single();

  const { data: menu } = await supabase
    .from('menu_items')
    .select('*')
    .eq('business_id', testBusiness.id);

  const { data: location } = await supabase
    .from('business_location_intelligence')
    .select('*')
    .eq('business_id', testBusiness.id)
    .single();

  console.log(`   ✅ Business: ${business?.name}`);
  console.log(`   ✅ Menu: ${menu?.length || 0} items`);
  console.log(`   ✅ Location: ${location?.neighborhood || location?.area_type || 'N/A'}\n`);

  // Layer 1: Programme Detection
  console.log('2️⃣  Layer 1: Programme Detection...');
  const programmes = generateProgrammeProfiles(menu || [], business);
  console.log(`   ✅ Detected ${programmes.length} programmes:`);
  programmes.forEach(p => {
    console.log(`      • ${p.programme_name} (${p.programme_type})`);
  });
  console.log('');

  // Layer 2: Commercial Orientation (per programme)
  console.log('3️⃣  Layer 2: Commercial Orientation (per programme)...');
  const programmesWithLayer2 = [];
  for (const programme of programmes) {
    const orientation = await generateCommercialOrientation(
      business,
      menu || [],
      programme,
      location,
      apiKey
    );
    programmesWithLayer2.push({ ...programme, ...orientation });
    console.log(`   ✅ ${programme.programme_name}: ${orientation.decision_timing}`);
  }
  console.log('');

  // Layer 3: Identity Profile (business-level)
  console.log('4️⃣  Layer 3: Identity Profile (business-level)...');
  const identity = await generateIdentityProfile(
    business,
    menu || [],
    programmesWithLayer2,
    location,
    apiKey
  );
  console.log(`   ✅ Brand Essence: ${identity.brand_essence?.substring(0, 80)}...`);
  console.log(`   ✅ Positioning: ${identity.positioning?.substring(0, 80)}...`);
  console.log('');

  // Layer 4: Audience Segmentation (per programme)
  console.log('5️⃣  Layer 4: Audience Segmentation (per programme)...');
  const finalProgrammes = [];
  for (const programme of programmesWithLayer2) {
    const audienceProfile = await generateAudienceSegments(
      business,
      menu || [],
      programme,
      programme, // commercial orientation
      identity,
      location,
      apiKey
    );
    finalProgrammes.push({ ...programme, ...audienceProfile });
    console.log(`   ✅ ${programme.programme_name}: ${audienceProfile.audience_segments?.length || 0} segments`);
    audienceProfile.audience_segments?.forEach((seg: any) => {
      console.log(`      • ${seg.label} (${seg.priority})`);
    });
  }
  console.log('');

  // Save to database
  console.log('6️⃣  Saving to database...');

  // Save Layer 3 (business-level) to business_brand_profile
  const { error: layer3Error } = await supabase
    .from('business_brand_profile')
    .update({
      positioning: identity.positioning,
      brand_essence: identity.brand_essence,
      values: identity.core_values, // maps to 'values' column
      what_makes_us_different: identity.what_makes_us_different,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', testBusiness.id);

  if (layer3Error) {
    console.error('   ⚠️  Layer 3 save error:', layer3Error.message);
  } else {
    console.log('   ✅ Layer 3 saved to business_brand_profile');
  }

  // Save Layers 1, 2, 4 (programme-level) to business_programme_profiles
  for (const programme of finalProgrammes) {
    const { error: progError } = await supabase
      .from('business_programme_profiles')
      .upsert({
        business_id: testBusiness.id,
        programme_type: programme.programme_type,
        programme_name: programme.programme_name,
        time_windows: programme.time_windows,
        operating_days: programme.operating_days,
        menu_evidence: programme.menu_evidence,
        confidence: programme.confidence,
        baseline_goal_split: programme.baseline_goal_split,
        decision_timing: programme.decision_timing,
        content_type_affinity: programme.content_type_affinity,
        audience_segments: programme.audience_segments,
        segment_confidence: programme.segment_confidence,
        segment_reasoning: programme.segment_reasoning,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,programme_type'
      });

    if (progError) {
      console.error(`   ⚠️  ${programme.programme_name} save error:`, progError.message);
    } else {
      console.log(`   ✅ ${programme.programme_name} saved`);
    }
  }

  console.log('\n✅ SUCCESS! Profile generated and saved.');
  console.log('\n📊 Summary:');
  console.log(`   • Business: ${business?.name}`);
  console.log(`   • Programmes: ${finalProgrammes.length}`);
  console.log(`   • Total Segments: ${finalProgrammes.reduce((sum, p) => sum + (p.audience_segments?.length || 0), 0)}`);
  console.log('\n👉 View in dashboard: http://localhost:3000/dashboard/brand');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  Deno.exit(1);
}
