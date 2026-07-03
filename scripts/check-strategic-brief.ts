import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'; // Café Faust
const WEEK_NUMBER = 19;

console.log(`📖 Reading Strategic Brief for Week ${WEEK_NUMBER}...\n`);

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, strategic_brief_raw, generated_at, id')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', WEEK_NUMBER)
  .order('generated_at', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}

if (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}

console.log(`📊 Found ${data?.length || 0} strategies for Week ${WEEK_NUMBER}\n`);

for (let i = 0; i < (data?.length || 0); i++) {
  const strategy = data[i];
  const timestamp = new Date(strategy.generated_at).toLocaleString('da-DK');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STRATEGY #${i + 1} (${timestamp})`);
  console.log(`ID: ${strategy.id}`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (strategy.strategic_brief?.angles) {
    console.log('📊 Strategic Brief Angles:\n');
    for (const angle of strategy.strategic_brief.angles) {
      console.log(`Slot ${angle.slot_id}:`);
      console.log(`  timing_window: ${angle.timing_window || 'N/A'}`);
      console.log(`  focus: ${angle.focus}`);
      console.log(`  goal_mode: ${angle.goal_mode}`);
      console.log(`  content_category: ${angle.suggested_content_category || angle.content_category || 'N/A'}`);
      console.log('');
    }
  }
  
  if (i === 0) {
    // Show raw brief for the latest one
    console.log('\n📋 RAW STRATEGIC BRIEF (first 3000 chars):');
    console.log(strategy.strategic_brief_raw?.substring(0, 3000) || 'N/A');
  }
}
