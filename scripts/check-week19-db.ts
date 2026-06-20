#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_19_START = '2026-05-11';

console.log('Fetching Week 19 strategy from database...\n');

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('*')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('week_start', WEEK_19_START)
  .single();

if (error) {
  console.error('Error:', error.message);
  Deno.exit(1);
}

console.log('Strategy status:', data.status);
console.log('Post ideas count:', data.post_ideas?.length || 0);
console.log('\nFull response keys:', Object.keys(data));

if (data.post_ideas && data.post_ideas.length > 0) {
  console.log('\nPost Ideas:');
  for (const idea of data.post_ideas) {
    console.log(`- Day: ${idea.suggested_day}, Slot: ${idea.slot_id}, Title: ${idea.title}`);
  }
}

console.log('\nCalendar Context:');
console.log(JSON.stringify(data.week_context_snapshot?.calendar_context, null, 2));
