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

// Check both business IDs
const BUSINESS_IDS = [
  'f4679fa9-3120-4a59-9506-d059b010c34a',  // Original Café Faust
  'ecd4c124-114f-40e6-9d85-c0af1f7783aa'   // From the data shown
];

for (const businessId of BUSINESS_IDS) {
  console.log(`\n🔍 Checking business ${businessId}:\n`);
  
  // Get business name
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, business_type')
    .eq('business_id', businessId)
    .maybeSingle();
  
  if (business) {
    console.log(`Business: ${business.business_name} (${business.business_type})`);
  } else {
    console.log('Business not found');
    continue;
  }
  
  // Get programmes
  const { data: programmes } = await supabase
    .from('business_programme_profiles')
    .select('programme_type, programme_name, baseline_goal_split')
    .eq('business_id', businessId);
  
  if (programmes && programmes.length > 0) {
    console.log(`\nProgrammes: ${programmes.length}`);
    programmes.forEach((prog, idx) => {
      console.log(`\n${idx + 1}. ${prog.programme_type} - ${prog.programme_name}`);
      console.log(`   baseline_goal_split type: ${typeof prog.baseline_goal_split}`);
      console.log(`   Raw value: ${prog.baseline_goal_split}`);
      
      // Try to parse if it's a string
      if (typeof prog.baseline_goal_split === 'string') {
        try {
          const parsed = JSON.parse(prog.baseline_goal_split);
          console.log(`   Parsed:`, parsed);
        } catch (e) {
          console.log(`   Parse error: ${e.message}`);
        }
      } else {
        console.log(`   Value:`, prog.baseline_goal_split);
      }
    });
  } else {
    console.log('\nNo programmes found');
  }
  
  // Check brand profile
  const { data: profile } = await supabase
    .from('business_brand_profile')
    .select('content_strategy')
    .eq('business_id', businessId)
    .maybeSingle();
  
  console.log(`\nBrand Profile: ${profile ? 'EXISTS' : 'NOT FOUND'}`);
  if (profile) {
    console.log(`content_strategy: ${profile.content_strategy ? 'EXISTS' : 'NULL'}`);
  }
}
