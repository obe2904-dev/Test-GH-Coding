// Diagnostic: Check authentication and RLS access
// Run with your browser's auth session
// This simulates what the frontend is doing

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 RLS DIAGNOSTIC\n');
console.log('Testing access to business_programme_profiles table with anon key...\n');

const testBusinessId = '840347de-9ba7-4275-8aa3-4553417fc2af';

// 1. Check if we can see the business (should fail with anon key)
console.log('1️⃣  Testing businesses table access:');
const { data: businesses, error: bizError } = await supabase
  .from('businesses')
  .select('id, name, owner_id')
  .eq('id', testBusinessId);

console.log('   Result:', businesses?.length || 0, 'rows');
if (bizError) console.log('   Error:', bizError.message);
if (businesses && businesses.length > 0) {
  console.log('   ✅ Business visible:', businesses[0].name);
  console.log('   Owner ID:', businesses[0].owner_id);
} else {
  console.log('   ❌ Business NOT visible (RLS blocking)');
}

// 2. Check if we can see programme profiles
console.log('\n2️⃣  Testing business_programme_profiles table access:');
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('*')
  .eq('business_id', testBusinessId);

console.log('   Result:', programmes?.length || 0, 'rows');
if (progError) console.log('   Error:', progError.message);
if (programmes && programmes.length > 0) {
  console.log('   ✅ Programme profiles visible');
  programmes.forEach((p: any) => {
    console.log(`      • ${p.programme_name} (${p.programme_type})`);
  });
} else {
  console.log('   ❌ Programme profiles NOT visible (RLS blocking)');
}

// 3. Check current auth state
console.log('\n3️⃣  Current auth state:');
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  console.log('   ✅ User authenticated:', user.email);
  console.log('   User ID:', user.id);
} else {
  console.log('   ❌ NOT authenticated (anon key has no session)');
}

console.log('\n📊 SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('The issue: Anon key queries have NO auth session.');
console.log('');
console.log('Solution: You must be LOGGED IN to the web app.');
console.log('');
console.log('Steps to fix:');
console.log('1. Open http://localhost:3000');
console.log('2. Make sure you are logged in');
console.log('3. Navigate to /dashboard/brand');
console.log('4. The frontend will use YOUR auth session');
console.log('5. RLS will match your user.id to business.owner_id');
console.log('6. Programme profiles will be visible');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
