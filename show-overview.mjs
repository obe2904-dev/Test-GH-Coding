const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('Getting week 24 overview...\n');

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
const overview = result.strategy?.narrative?.overview || 'No overview';

console.log('Overview text:');
console.log('─'.repeat(60));
console.log(overview);
console.log('─'.repeat(60));

const hasForbidden = ['hygge', 'hyggelig', 'oplagt'].some(word => 
  overview.toLowerCase().includes(word)
);

console.log(hasForbidden ? '\n❌ Contains forbidden words' : '\n✅ Clean');
