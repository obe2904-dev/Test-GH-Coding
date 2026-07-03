import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('id, week_start, status, created_at, post_ideas')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.log('❌ Error:', error.message);
} else if (data) {
  console.log('📊 Latest strategy:');
  console.log('   Week:', data.week_start);
  console.log('   Status:', data.status);
  console.log('   Created:', data.created_at);
  console.log('   Post ideas count:', data.post_ideas?.length || 0);
  
  if (data.status === 'error') {
    console.log('\n⚠️  Strategy status is "error"');
    console.log('   Check Edge Function logs for details');
  }
} else {
  console.log('❌ No strategies found');
}
