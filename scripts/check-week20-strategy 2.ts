import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

// Get Week 20 strategy
const { data: strategies, error } = await supabase
  .from('weekly_strategies')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .gte('week_start', '2026-05-11')
  .lte('week_start', '2026-05-11')
  .limit(1);

if (error) {
  console.error('❌ Error fetching strategy:', error);
  Deno.exit(1);
}

if (!strategies || strategies.length === 0) {
  console.log('No Week 20 strategy found');
  Deno.exit(0);
}

const strategy = strategies[0];

console.log('═══════════════════════════════════════════════');
console.log('WEEK 20 STRATEGIC BRIEF (NEW FRAMEWORK)');
console.log('═══════════════════════════════════════════════\n');

console.log('� RAW STRATEGY OBJECT:');
console.log(JSON.stringify(strategy, null, 2));

console.log('\n═══════════════════════════════════════════════');
