/**
 * QUICK ACTIVATION TEST
 * 
 * Simple test to validate activation engine is working:
 * 1. Generate Week 20 (holiday week)
 * 2. Show activation output in logs
 * 3. Show validation results
 */

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  Deno.exit(1);
}

console.log('🧪 Testing Activation Engine - Week 20 (Kr. Himmelfartsdag)');
console.log('═══════════════════════════════════════════════════════════════\n');

const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    business_id: '2037d63c-a138-4247-89c5-5b6b8cef9f3f', // Café Faust
    week_start: '2026-05-11',
    regenerate: true,
  }),
});

console.log(`Response Status: ${response.status}\n`);

if (response.status !== 202) {
  console.error('❌ Request failed');
  console.error(await response.text());
  Deno.exit(1);
}

const result = await response.json();
console.log('✅ Request submitted successfully');
console.log(`Strategy ID: ${result.strategy_id}`);
console.log(`Status: ${result.status}\n`);

console.log('⏳ The activation engine will run in the background.');
console.log('Check Supabase logs for:');
console.log('  1. [PRE-PHASE] Activation Engine output');
console.log('  2. [Activation Validator] validation results');
console.log('  3. [Phase 2b] timing assignments\n');

console.log('Expected behavior for Week 20:');
console.log('  ✓ Family segments activated to "surge" priority');
console.log('  ✓ Work segments deactivated');
console.log('  ✓ Timing windows extended Thu-Fri-Sat-Sun');
console.log('  ✓ Posts scheduled within activation windows');
console.log('  ✓ Validation passes with 0 errors, <3 warnings\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('Test request submitted. Check logs at:');
console.log('https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions/get-weekly-strategy/logs');
console.log('═══════════════════════════════════════════════════════════════');
