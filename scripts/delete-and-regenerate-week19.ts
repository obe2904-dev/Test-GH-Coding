import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_NUMBER = 20;

console.log(`🗑️  Deleting all Week ${WEEK_NUMBER} strategies...\n`);

// Delete all Week 19 strategies (this will cascade to delete related content_plans too)
const { data: toDelete, error: fetchError } = await supabase
  .from('weekly_strategies')
  .select('id')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', WEEK_NUMBER);

if (fetchError) {
  console.error('❌ Error fetching strategies:', fetchError);
  Deno.exit(1);
}

console.log(`Found ${toDelete?.length || 0} strategies to delete\n`);

for (const strategy of toDelete || []) {
  console.log(`Deleting strategy: ${strategy.id}...`);
  
  // Delete content plans first
  const { error: plansError } = await supabase
    .from('weekly_content_plans')
    .delete()
    .eq('strategy_id', strategy.id);
  
  if (plansError) {
    console.error(`  ❌ Error deleting content plans: ${plansError.message}`);
  } else {
    console.log(`  ✅ Deleted content plans`);
  }
  
  // Delete strategy
  const { error: deleteError } = await supabase
    .from('weekly_strategies')
    .delete()
    .eq('id', strategy.id);
  
  if (deleteError) {
    console.error(`  ❌ Error deleting strategy: ${deleteError.message}`);
  } else {
    console.log(`  ✅ Deleted strategy`);
  }
}

console.log('\n✅ All Week 19 strategies deleted!');
console.log('\nNow generate fresh by calling the API without regenerate flag...\n');

const response = await fetch(`${supabaseUrl}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    business_id: BUSINESS_ID,
    week_number: WEEK_NUMBER,
    year: 2026,
  }),
});

const result = await response.json();

console.log('API Response:', response.status);
console.log('Post Ideas:', result.post_ideas?.length || result.strategy?.post_ideas?.length || 0);

if (!response.ok) {
  console.error('❌ Error:', result);
} else {
  console.log('✅ Fresh strategy generated!');
}
