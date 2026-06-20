#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 Checking database connection and structure\n');

// List all businesses
const { data: businesses, error: bizError } = await supabase
  .from('businesses')
  .select('business_id, business_name')
  .limit(10);

if (bizError) {
  console.error('❌ Error fetching businesses:', bizError);
} else {
  console.log(`Found ${businesses.length} businesses (showing first 10):`);
  businesses.forEach(b => console.log(`  - ${b.business_name} (${b.business_id})`));
}

// Check programme profiles
console.log('\n\n🔍 Checking business_programme_profiles:\n');
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('business_id, programme_type, programme_name, baseline_goal_split')
  .limit(3);

if (progError) {
  console.error('❌ Error:', progError);
} else {
  console.log(`Found ${programmes?.length || 0} programme profiles (showing first 3):\n`);
  programmes?.forEach((prog, idx) => {
    console.log(`${idx + 1}. Business: ${prog.business_id}`);
    console.log(`   Programme: ${prog.programme_type} - ${prog.programme_name}`);
    console.log(`   baseline_goal_split type: ${typeof prog.baseline_goal_split}`);
    console.log(`   baseline_goal_split value: ${JSON.stringify(prog.baseline_goal_split).substring(0, 100)}...`);
    console.log('');
  });
}
