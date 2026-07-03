import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data } = await supabase
  .from('weekly_strategies')
  .select('id, week_start, week_number, generated_at')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .eq('week_number', 19)
  .order('generated_at', { ascending: false });

console.log(JSON.stringify(data, null, 2));
