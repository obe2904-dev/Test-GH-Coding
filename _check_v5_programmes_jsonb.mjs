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

console.log('🔍 Checking business_brand_profile V5 JSONB structure\n');

const { data: profile, error } = await supabase
  .from('business_brand_profile')
  .select('programmes, content_strategy, brand_voice')
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

console.log('V5 Programmes (JSONB column):');
if (profile.programmes && Array.isArray(profile.programmes)) {
  console.log(`Found ${profile.programmes.length} programme(s)\n`);
  
  profile.programmes.forEach((prog, idx) => {
    console.log(`${idx + 1}. ${prog.type?.toUpperCase()} - ${prog.name}`);
    console.log('   baseline_goal_split:');
    const split = prog.commercialOrientation?.baseline_goal_split;
    if (split) {
      console.log(JSON.stringify(split, null, 6));
    } else {
      console.log('      NULL or missing');
    }
    console.log('');
  });
  
  // Calculate what content_strategy should be
  console.log('📊 Calculating content_strategy from V5 programmes:\n');
  
  const aggregateGoals = profile.programmes.reduce((acc, prog) => {
    const split = prog.commercialOrientation?.baseline_goal_split;
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
} else {
  console.log('NULL or not an array');
}

console.log('\n\nCurrent content_strategy field:');
console.log(profile.content_strategy ? JSON.stringify(profile.content_strategy, null, 2) : 'NULL');
