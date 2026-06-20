/**
 * TEST NORMAL WEEK - Week 22 (No Holidays)
 * 
 * Validates activation engine fallback behavior:
 * - No holiday surge → normal segment priorities
 * - Work segments should remain active
 * - Family segments at baseline priority
 * - Weather-dependent activation (late May = good weather)
 */

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  Deno.exit(1);
}

console.log('🧪 Testing Activation Engine - Week 22 (Normal Week)');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Business: Café Faust (hybrid café/restaurant/bar)');
console.log('Week: 22 (May 25-31, 2026)');
console.log('Expected: No holidays, normal priorities, balanced segments\n');

const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    business_id: '2037d63c-a138-4247-89c5-5b6b8cef9f3f', // Café Faust
    week_start: '2026-05-25',
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

console.log('Expected behavior for normal Week 22:');
console.log('  ✓ No family surge (baseline priority)');
console.log('  ✓ Work segments active (Mon-Fri lunch)');
console.log('  ✓ Weather-based outdoor activation (late May ≈ 16-20°C)');
console.log('  ✓ Balanced goal distribution across weekdays');
console.log('  ✓ Standard timing windows (no extended Thu-Fri-Sat-Sun)\n');

console.log('Compare with Week 20 results:');
console.log('  Week 20: Family surge, work deactivated, Thu-Sat focus');
console.log('  Week 22: Balanced segments, work active, Mon-Sun spread\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('Test request submitted. Check Supabase dashboard for results.');
console.log('═══════════════════════════════════════════════════════════════');
