// Check if business_brand_profile row exists at all
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/check-brand-profile-exists.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

const testBusinessId = '840347de-9ba7-4275-8aa3-4553417fc2af';

console.log('🔍 Checking if business_brand_profile row exists\n');

// Try to select with .maybeSingle() instead of .single()
const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, positioning, brand_essence, created_at, updated_at')
  .eq('business_id', testBusinessId)
  .maybeSingle();

console.log('Query result:');
console.log('Error:', error);
console.log('Data:', data);

if (error) {
  console.log('\n❌ Error querying business_brand_profile');
} else if (!data) {
  console.log('\n⚠️  No business_brand_profile row exists for this business');
  console.log('   The V5 Edge Function tried to UPDATE, but there is no row to update!');
  console.log('   Solution: The Edge Function should INSERT or UPSERT instead of UPDATE');
} else {
  console.log('\n✅ business_brand_profile row exists');
  console.log(`   Business ID: ${data.business_id}`);
  console.log(`   Positioning: ${data.positioning || 'NULL'}`);
  console.log(`   Brand Essence: ${data.brand_essence ? data.brand_essence.slice(0, 50) + '...' : 'NULL'}`);
  console.log(`   Created: ${data.created_at}`);
  console.log(`   Updated: ${data.updated_at}`);
}
