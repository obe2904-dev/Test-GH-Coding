import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data: strategy } = await supabase
  .from('weekly_strategies')
  .select('id')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .eq('week_number', 20)
  .single();

if (!strategy) {
  console.error('No strategy found');
  Deno.exit(1);
}

const { data: plans } = await supabase
  .from('content_plans')
  .select('*')
  .eq('weekly_strategy_id', strategy.id)
  .order('scheduled_date, scheduled_time');

console.log('\n📅 CONTENT PLANS (what will be posted):');
plans?.forEach((p: any) => {
  const date = new Date(p.scheduled_date);
  const dayName = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'][date.getDay()];
  console.log(`\n${dayName} ${p.scheduled_date.slice(8, 10)}. ${p.scheduled_time}`);
  console.log(`  ${p.title}`);
  console.log(`  Goal: ${p.goal_mode} | Category: ${p.content_category}`);
  console.log(`  Status: ${p.status}`);
});
