#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_19_START = '2026-05-11';

// Fetch the saved strategy
const { data, error } = await supabase
  .from('weekly_strategies')
  .select('week_context_snapshot')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('week_start', WEEK_19_START)
  .single();

if (error) {
  console.error('Error:', error.message);
  Deno.exit(1);
}

console.log('\n📋 Week Context Snapshot:\n');
console.log('Calendar Context:');
console.log(JSON.stringify(data.week_context_snapshot.calendar_context, null, 2));
