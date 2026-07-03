import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTE3MDYsImV4cCI6MjA0NzE2NzcwNn0.U73ZpLDwrP55E5W1cP82lMzQb-V0Zj_0u9I4Ry3W0l4'
);

const { data: strategy, error: stratError } = await supabase
  .from('business_weekly_strategies')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('week_starting', { ascending: false })
  .limit(1)
  .single();

if (stratError || !strategy) {
  console.log('❌ Error:', stratError?.message || 'No strategy found');
  process.exit(1);
}

const { data: posts } = await supabase
  .from('business_post_ideas')
  .select('*')
  .eq('strategy_id', strategy.id)
  .order('suggested_time');

console.log('📊 Post Slot Assignments:\n');
posts.forEach((post, i) => {
  console.log(`${i + 1}. ${post.title}`);
  console.log(`   Slot: ${post.content_slot}`);
  console.log(`   Time: ${post.suggested_time}`);
  console.log(`   Service Period: ${post.service_period}`);
  console.log('');
});
