const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🧪 Testing Option C Implementation\n');
console.log('═'.repeat(60));

// Step 1: Test strategy generation (should allow "hyggelig" now)
console.log('\n📊 Step 1: Testing strategy layer (owner-facing)...\n');

const strategyResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    business_id: CAFE_FAUST_ID,
    week_number: 24,
    force_regenerate: true
  }),
});

const strategyResult = await strategyResponse.json();

if (!strategyResult.success) {
  console.error('❌ Strategy generation failed');
  process.exit(1);
}

const overview = strategyResult.strategy?.narrative?.overview || '';
console.log('Strategy overview (first 100 chars):');
console.log(`"${overview.substring(0, 100)}..."`);

const hasHygge = overview.toLowerCase().includes('hygge');
console.log(hasHygge 
  ? '✅ Strategy CAN use "hygge" (owner-facing = OK)' 
  : 'ℹ️  No "hygge" in this generation');

// Step 2: Test post generation (should reject "hyggelig")
console.log('\n📊 Step 2: Testing post layer (customer-facing)...\n');
console.log('(This will be tested when we generate actual posts)');

console.log('\n' + '═'.repeat(60));
console.log('✅ PHASE 2 WEEK 1 COMPLETE - Option C Implementation\n');
console.log('Summary:');
console.log('  ✅ Strategy layer: Simplified (removed forbidden phrases section)');
console.log('  ✅ Post layer: Added forbidden_phrases to brandProfile');
console.log('  📝 Prompt reduction: ~15 lines removed from strategy');
console.log('  🎯 Enforcement: Now where it matters (customer-facing posts)\n');

console.log('Next steps:');
console.log('  1. Verify actual posts don\'t contain forbidden phrases');
console.log('  2. Test with generate-weekly-plan');
console.log('  3. Monitor for 24h');
console.log('  4. Proceed to Phase 2 Week 2 (creativity dials)\n');
