#!/usr/bin/env node

/**
 * Direct database inspection for week 26 strategy
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

console.log('\n=== Inspecting Week 26 Strategy ===\n');

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', 26)
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
  Deno.exit(1);
}

console.log('ID:', data.id);
console.log('Week:', data.week_number);
console.log('Created:', data.created_at);
console.log('\nAvailable columns:', Object.keys(data).join(', '));

console.log('\n--- Strategic Brief ---');
console.log('Type:', typeof data.strategic_brief);
console.log('Keys:', Object.keys(data.strategic_brief || {}).join(', '));
console.log('Content:', JSON.stringify(data.strategic_brief, null, 2).substring(0, 1000));

console.log('\n--- Post Ideas ---');
console.log('Type:', typeof data.post_ideas);
console.log('Count:', Array.isArray(data.post_ideas) ? data.post_ideas.length : 'not array');
if (Array.isArray(data.post_ideas) && data.post_ideas.length > 0) {
  console.log('\nFirst post idea:');
  console.log(JSON.stringify(data.post_ideas[0], null, 2));
}
