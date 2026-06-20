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

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔍 Checking business_brand_profile for Café Faust\n');

// First, let's see what columns exist
const { data: profile, error } = await supabase
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .maybeSingle();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!profile) {
  console.log('⚠️  No brand profile found');
  process.exit(0);
}

console.log('All columns in business_brand_profile:');
console.log(Object.keys(profile).sort().join('\n'));

console.log('\n\n📋 Relevant fields:');
console.log('\ncontent_strategy:', profile.content_strategy ? 'EXISTS' : 'NULL');
if (profile.content_strategy) {
  console.log(JSON.stringify(profile.content_strategy, null, 2));
}

console.log('\nbrand_voice:', profile.brand_voice ? 'EXISTS' : 'NULL');
if (profile.brand_voice) {
  console.log('brand_voice keys:', Object.keys(profile.brand_voice).join(', '));
  if (profile.brand_voice.content_strategy) {
    console.log('brand_voice.content_strategy:');
    console.log(JSON.stringify(profile.brand_voice.content_strategy, null, 2));
  }
}

// Now check business_programme_profiles separately
console.log('\n\n🔍 Checking business_programme_profiles table:\n');

const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, baseline_goal_split')
  .eq('business_id', BUSINESS_ID);

if (progError) {
  console.error('❌ Error:', progError);
} else if (!programmes || programmes.length === 0) {
  console.log('⚠️  No programmes found in business_programme_profiles');
} else {
  console.log(`Found ${programmes.length} programme(s):`);
  programmes.forEach((prog, idx) => {
    console.log(`\n${idx + 1}. ${prog.programme_type} - ${prog.programme_name}`);
    console.log('   baseline_goal_split:', JSON.stringify(prog.baseline_goal_split, null, 6));
  });
}
