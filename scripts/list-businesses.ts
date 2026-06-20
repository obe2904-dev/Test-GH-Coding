// List available businesses
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('📋 Fetching available businesses...\n');

const { data: businesses, error } = await supabase
  .from('businesses')
  .select('id, name')
  .limit(10);

if (error) {
  console.error('❌ Error:', error);
  console.log('\nThis might be an RLS (Row Level Security) issue.');
  console.log('The anon key might not have access to businesses table.');
  console.log('\nPlease check in Supabase Dashboard → SQL Editor:');
  console.log('  SELECT id, name FROM businesses LIMIT 10;');
} else if (!businesses || businesses.length === 0) {
  console.log('❌ No businesses found in database.');
} else {
  console.log(`✅ Found ${businesses.length} business(es):\n`);
  businesses.forEach((b, i) => {
    console.log(`${i + 1}. ${b.name}`);
    console.log(`   ID: ${b.id}\n`);
  });
}
