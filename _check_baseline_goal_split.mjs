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

console.log('🔍 Checking business_programme_profiles for Café Faust\n');

const { data: programmes, error } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, baseline_goal_split, decision_timing')
  .eq('business_id', BUSINESS_ID);

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!programmes || programmes.length === 0) {
  console.log('⚠️  No programmes found for this business');
  process.exit(0);
}

console.log(`Found ${programmes.length} programme(s):\n`);

programmes.forEach((prog, idx) => {
  console.log(`${idx + 1}. ${prog.programme_type.toUpperCase()} - ${prog.programme_name}`);
  console.log('   baseline_goal_split:');
  if (prog.baseline_goal_split) {
    console.log(JSON.stringify(prog.baseline_goal_split, null, 6));
  } else {
    console.log('      NULL');
  }
  console.log('   decision_timing:', prog.decision_timing || 'NULL');
  console.log('');
});

// Calculate what content_strategy should be
console.log('📊 Calculating content_strategy from programmes:\n');

const aggregateGoals = programmes.reduce((acc, prog) => {
  const split = prog.baseline_goal_split;
  if (split) {
    acc.drive_footfall += split.drive_footfall || 0;
    acc.build_brand += split.strengthen_brand || 0;
    acc.retain_loyalty += split.retain_regulars || 0;
  }
  return acc;
}, { drive_footfall: 0, build_brand: 0, retain_loyalty: 0 });

const total = aggregateGoals.drive_footfall + aggregateGoals.build_brand + aggregateGoals.retain_loyalty;

if (total === 0) {
  console.log('⚠️  All baseline_goal_split values are 0 or missing');
} else {
  const goal_blend = {
    drive_footfall: Math.round((aggregateGoals.drive_footfall / total) * 100),
    build_brand: Math.round((aggregateGoals.build_brand / total) * 100),
    retain_loyalty: Math.round((aggregateGoals.retain_loyalty / total) * 100)
  };
  
  console.log('Expected content_strategy.goal_blend:');
  console.log(JSON.stringify(goal_blend, null, 2));
  
  const primary_goal = goal_blend.drive_footfall >= 45 ? 'drive_footfall' 
    : goal_blend.build_brand >= 45 ? 'build_brand'
    : goal_blend.retain_loyalty >= 45 ? 'retain_loyalty'
    : 'drive_footfall';
  
  console.log('\nPrimary goal:', primary_goal);
}
