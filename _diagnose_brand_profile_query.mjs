// Exact replica of get-weekly-strategy brand profile query
// This will help us see what's actually being returned

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';
const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';

// Test with service role key (from env vars that Edge Function uses)
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo';

console.log('Testing exact query that get-weekly-strategy makes...\n');

// Test 1: Query with all 5 columns
console.log('=== TEST 1: Full query (5 columns) ===');
const columns = 'brand_profile_v5,brand_essence,business_character,target_type_mix,revenue_drivers';
const url1 = `${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${businessId}&select=${columns}`;

const response1 = await fetch(url1, {
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Accept': 'application/vnd.pgrst.object+json',
    'Prefer': 'return=representation'
  }
});

console.log('Status:', response1.status);
console.log('Headers:', Object.fromEntries(response1.headers.entries()));

const result1 = await response1.json();
console.log('Response:', JSON.stringify(result1, null, 2));

if (response1.ok) {
  console.log('\n✅ Query succeeded');
  console.log('Keys returned:', Object.keys(result1));
  console.log('Has revenue_drivers:', !!result1.revenue_drivers);
  console.log('revenue_drivers type:', typeof result1.revenue_drivers);
} else {
  console.log('\n❌ Query failed');
}

// Test 2: Query with only revenue_drivers (minimal)
console.log('\n\n=== TEST 2: Minimal query (revenue_drivers only) ===');
const url2 = `${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${businessId}&select=revenue_drivers`;

const response2 = await fetch(url2, {
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Accept': 'application/vnd.pgrst.object+json'
  }
});

const result2 = await response2.json();
console.log('Status:', response2.status);
console.log('Response:', JSON.stringify(result2, null, 2));

// Test 3: Check what columns actually exist
console.log('\n\n=== TEST 3: Check actual table schema ===');
const url3 = `${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${businessId}&select=*&limit=1`;

const response3 = await fetch(url3, {
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Accept': 'application/vnd.pgrst.object+json'
  }
});

const result3 = await response3.json();
console.log('Status:', response3.status);
if (response3.ok) {
  console.log('All columns in table:', Object.keys(result3));
  console.log('Has brand_essence:', 'brand_essence' in result3);
  console.log('Has target_type_mix:', 'target_type_mix' in result3);
  console.log('Has revenue_drivers:', 'revenue_drivers' in result3);
}
