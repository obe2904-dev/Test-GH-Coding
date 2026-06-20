// Get owner_id for Café Faust
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/get-owner-id.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

const testBusinessId = '840347de-9ba7-4275-8aa3-4553417fc2af';

console.log('🔍 Getting owner_id for business\n');

const { data, error } = await supabase
  .from('businesses')
  .select('id, name, owner_id')
  .eq('id', testBusinessId)
  .maybeSingle();

console.log('Result:');
console.log('Error:', error);
console.log('Data:', data);

if (data) {
  console.log(`\n✅ Business: ${data.name}`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Owner ID: ${data.owner_id}`);
} else {
  console.log('\n❌ Could not find business (RLS blocked)');
}
