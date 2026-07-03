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

const { data, error } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, baseline_goal_split')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('Café Faust Programmes:\n');
data.forEach(p => {
  console.log(`${p.programme_type} (${p.programme_name}):`);
  console.log(JSON.stringify(p.baseline_goal_split, null, 2));
  console.log('');
});
