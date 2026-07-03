#!/usr/bin/env node

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

const { data } = await supabase
  .from('weekly_strategies')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', 26)
  .single();

console.log('\n=== Week 26 Strategy Full Record ===\n');
console.log('ID:', data.id);
console.log('Status:', data.status);
console.log('Generated at:', data.generated_at);
console.log('\nAvailable fields:', Object.keys(data).sort().join(', '));

console.log('\n--- Strategic Brief ---');
console.log('Type:', typeof data.strategic_brief);
console.log('Is null:', data.strategic_brief === null);
console.log('Is empty object:', JSON.stringify(data.strategic_brief) === '{}');

if (data.strategic_brief) {
  console.log('Keys:', Object.keys(data.strategic_brief).join(', '));
  console.log('\nContent (first 2000 chars):');
  console.log(JSON.stringify(data.strategic_brief, null, 2).substring(0, 2000));
}

console.log('\n--- Post Ideas ---');
console.log('Type:', typeof data.post_ideas);
console.log('Is null:', data.post_ideas === null);
console.log('Is array:', Array.isArray(data.post_ideas));
if (Array.isArray(data.post_ideas)) {
  console.log('Length:', data.post_ideas.length);
}

console.log('\n--- Strategy Rationale ---');
if (data.strategy_rationale) {
  console.log(data.strategy_rationale.substring(0, 500));
}
