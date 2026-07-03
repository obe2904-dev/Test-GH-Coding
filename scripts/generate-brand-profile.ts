// Test the NEW 5-layer brand profile system by calling the Edge Function
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

// Café Faust from businesses table
const testBusinessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

console.log('🚀 Generating NEW 5-layer brand profile for Café Faust...\n');
console.log(`Business ID: ${testBusinessId}\n`);

const startTime = Date.now();

try {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/brand-profile-generator-v5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: testBusinessId,
        forceRegenerate: true  // Force regeneration to create NEW 5-layer profile
      })
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Function failed (${response.status}) after ${elapsed}s:`);
    console.error(errorText);
    Deno.exit(1);
  }

  const result = await response.json();

  console.log(`✅ Profile generated in ${elapsed}s\n`);
  console.log('📊 Result:');
  console.log(JSON.stringify(result, null, 2));

  // Check what was saved
  if (result.success) {
    console.log('\n✅ NEW Brand Profile System (Layers 1-4):');
    console.log('   Layer 1: Programme Detection ✅');
    console.log('   Layer 2: Commercial Orientation ✅');
    console.log('   Layer 3: Identity Profile ✅');
    console.log('   Layer 4: Audience Segmentation ✅');
    console.log('\n📍 View in dashboard: http://localhost:3000/dashboard/brand');
  }

} catch (error) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`❌ Error after ${elapsed}s:`, error);
  Deno.exit(1);
}
