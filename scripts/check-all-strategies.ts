import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

console.log('All Café Faust strategies:\n');

const { data } = await supabase
  .from('weekly_strategies')
  .select('id, week_number, week_start, status, generated_at, post_ideas')
  .eq('business_id', BUSINESS_ID)
  .order('generated_at', { ascending: false })
  .limit(10);

for (const strat of data || []) {
  const timestamp = new Date(strat.generated_at).toLocaleString('da-DK');
  console.log(`Week ${strat.week_number} (${strat.week_start}): ${strat.status}, ${strat.post_ideas?.length || 0} posts, ${timestamp}`);
}
