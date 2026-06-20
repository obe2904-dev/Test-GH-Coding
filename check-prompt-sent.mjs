const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔍 Checking what prompt is sent to AI...\n');
console.log('Generating fresh week 24 strategy...\n');

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

// Check logs for the debug output
console.log('Check Supabase logs for:');
console.log('[Phase2c DEBUG] Guardrails extracted');
console.log('\nLook for forbidden_count: should be 31, not 0\n');

const overview = result.strategy?.narrative?.overview || '';
console.log('Generated overview:');
console.log('─'.repeat(60));
console.log(overview);
console.log('─'.repeat(60));

const forbidden = ['hygge', 'hyggelig'].filter(w => overview.toLowerCase().includes(w));
console.log(forbidden.length > 0 ? `\n❌ Found: ${forbidden.join(', ')}` : '\n✅ Clean');
