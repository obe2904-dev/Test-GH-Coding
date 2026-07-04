// Simulate the exact query that get-weekly-strategy makes
// Uses environment variables like the Edge Function does

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo';

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

// Make the exact same query
const response = await fetch(`${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${businessId}&select=brand_profile_v5,brand_essence,business_character,target_type_mix,revenue_drivers`, {
  headers: {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Accept': 'application/vnd.pgrst.object+json'
  }
});

const result = await response.json();

console.log('Status:', response.status);
console.log('Has error:', !response.ok);

if (!response.ok) {
  console.log('Error:', result);
} else {
  console.log('\n✅ Query successful!');
  console.log('\nColumns returned:', Object.keys(result));
  console.log('\nHas revenue_drivers:', !!result.revenue_drivers);
  console.log('revenue_drivers type:', typeof result.revenue_drivers);
  console.log('revenue_drivers value:', result.revenue_drivers === null ? 'null' : result.revenue_drivers === undefined ? 'undefined' : 'exists');
  
  if (result.revenue_drivers) {
    console.log('\n📊 Revenue Drivers Data:');
    console.log(JSON.stringify(result.revenue_drivers, null, 2));
  }
}
