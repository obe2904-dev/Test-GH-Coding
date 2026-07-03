const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔍 Triggering fresh generation to check logs...\n');
console.log('Watch for console output from phase2c.ts:\n');
console.log('Expected: "[Phase2c OK] Forbidden phrases loaded: 31 items"');
console.log('Problem:  "[Phase2c ERROR] No forbidden phrases extracted!"');
console.log('─'.repeat(60));

const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
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

const result = await response.json();

if (result.success) {
  console.log('\n✅ Generation completed');
  console.log('\nNow check Supabase Dashboard > Functions > get-weekly-strategy > Logs');
  console.log('https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions');
  console.log('\nLook for the debug output showing if guardrails were extracted.');
} else {
  console.error('❌ Generation failed:', result.error);
}
