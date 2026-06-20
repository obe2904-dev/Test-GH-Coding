#!/usr/bin/env node

/**
 * Populate missing content_strategy for businesses with existing V5 profiles
 * 
 * This script triggers the v5 generator which will now automatically
 * derive and save content_strategy from existing programme data if missing.
 * 
 * Run: node _populate_missing_content_strategy.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Café Faust test business
const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔧 Populating content_strategy for Café Faust...\n');

// Check current state
console.log('Step 1: Checking current content_strategy...');
const { data: current, error: checkError } = await supabase
  .from('business_brand_profile')
  .select('content_strategy')
  .eq('business_id', BUSINESS_ID)
  .maybeSingle();

if (checkError) {
  console.error('❌ Query failed:', checkError);
  process.exit(1);
}

console.log('Current content_strategy:', current?.content_strategy ? '✅ Exists' : '❌ NULL');

if (current?.content_strategy) {
  console.log('\n✨ content_strategy already populated!');
  console.log(JSON.stringify(current.content_strategy, null, 2));
  process.exit(0);
}

// Trigger v5 generator (will auto-populate content_strategy)
console.log('\nStep 2: Triggering v5 generator to populate content_strategy...');
const response = await fetch(`${supabaseUrl}/functions/v1/brand-profile-generator-v5`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessId: BUSINESS_ID,
    forceRegenerate: false  // Don't force full regeneration
  })
});

if (!response.ok) {
  const text = await response.text();
  console.error('❌ Generator call failed:', response.status, text);
  process.exit(1);
}

const result = await response.json();
console.log('✅ Generator response:', result.message);

// Verify content_strategy was populated
console.log('\nStep 3: Verifying content_strategy...');
const { data: updated, error: verifyError } = await supabase
  .from('business_brand_profile')
  .select('content_strategy')
  .eq('business_id', BUSINESS_ID)
  .maybeSingle();

if (verifyError) {
  console.error('❌ Verification query failed:', verifyError);
  process.exit(1);
}

if (!updated?.content_strategy) {
  console.error('❌ content_strategy is still NULL');
  console.log('Try running with forceRegenerate: true');
  process.exit(1);
}

console.log('✅ content_strategy populated!\n');
console.log('📊 Content Strategy:');
console.log(JSON.stringify(updated.content_strategy, null, 2));

console.log('\n✨ SUCCESS!');
console.log('\nGoal Blend:');
const gb = updated.content_strategy.goal_blend;
console.log(`  - Drive Footfall: ${gb.drive_footfall}%`);
console.log(`  - Build Brand: ${gb.build_brand}%`);
console.log(`  - Retain Loyalty: ${gb.retain_loyalty}%`);
console.log(`\nPrimary Goal: ${updated.content_strategy.primary_goal}`);
