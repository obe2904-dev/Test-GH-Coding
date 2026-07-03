import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_NUMBER = 19;

console.log(`📅 Checking which strategy is linked to current posts...\n`);

// Get all strategies for Week 19
const { data: strategies, error: stratError } = await supabase
  .from('weekly_strategies')
  .select('id, generated_at, post_ideas')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', WEEK_NUMBER)
  .order('generated_at', { ascending: false });

if (stratError) {
  console.error('Error:', stratError);
  Deno.exit(1);
}

console.log(`Found ${strategies.length} strategies:\n`);

for (const strat of strategies) {
  const timestamp = new Date(strat.generated_at).toLocaleString('da-DK');
  console.log(`\nStrategy ID: ${strat.id}`);
  console.log(`Generated: ${timestamp}`);
  console.log(`Post Ideas: ${strat.post_ideas?.length || 0}`);
  
  if (strat.post_ideas && strat.post_ideas.length > 0) {
    console.log('Posts:');
    for (let i = 0; i < Math.min(2, strat.post_ideas.length); i++) {
      const idea = strat.post_ideas[i];
      console.log(`  Post #${i + 1}:`, JSON.stringify(idea, null, 2));
    }
  }
}
