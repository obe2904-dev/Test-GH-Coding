#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

// Test V5.9 voice guardrails validation with Restaurant Valdemar

const envContent = await Deno.readTextFile('.env');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY;

// Restaurant Valdemar
const testBusinessId = '07a5a2c7-4aa8-49b3-a125-6f687caf0f28';

console.log('🚀 Testing V5.9 Voice Guardrails Validation for Restaurant Valdemar...\n');
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
        forceRegenerate: true  // Force regeneration to test validation
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
  console.log('📊 V5.9 Validation Results:');
  console.log('   Check Supabase function logs for:');
  console.log('   - 🔍 Validating marketing brief against voice guardrails...');
  console.log('   - ⚠️  Marketing brief has X guardrail violations');
  console.log('   - ✅ Marketing brief passed all guardrail checks');
  console.log('\nResult:', JSON.stringify(result, null, 2));

} catch (error) {
  console.error('❌ Test failed:', error.message);
  Deno.exit(1);
}
