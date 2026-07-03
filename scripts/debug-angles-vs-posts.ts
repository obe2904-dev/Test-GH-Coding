import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('post_ideas, strategic_brief')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .eq('week_number', 20)
  .single();

if (error || !data) {
  console.error('Error:', error);
  Deno.exit(1);
}

console.log('\n📊 ANGLES FROM STRATEGIC BRIEF:');
data.strategic_brief.angles.forEach((a: any, i: number) => {
  console.log(`\n${i+1}. ${a.focus}`);
  console.log(`   Slot: ${a.slot_id} | Goal: ${a.goal_mode}`);
  console.log(`   Timing: ${a.timing_window}`);
  console.log(`   Category: ${a.content_category}`);
});

console.log('\n\n📝 POST IDEAS GENERATED:');
data.post_ideas.forEach((p: any, i: number) => {
  console.log(`\n${i+1}. ${p.title}`);
  console.log(`   Day: ${p.suggested_day} ${p.suggested_time}`);
  console.log(`   Goal: ${p.goal_mode} | Category: ${p.content_category}`);
  console.log(`   Angle: ${p.angle_focus}`);
});

console.log(`\n\nTotal angles: ${data.strategic_brief.angles.length}`);
console.log(`Total posts: ${data.post_ideas.length}`);
