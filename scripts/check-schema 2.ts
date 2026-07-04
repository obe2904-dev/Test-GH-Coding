// Check businesses table schema
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('businesses')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Sample business data:');
  console.log(JSON.stringify(data[0], null, 2));
}
