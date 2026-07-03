#!/usr/bin/env node
/**
 * Regenerate ONLY Trigger Configuration for Café Faust
 * 
 * Lightweight approach: Calls commercial strategy analyzer directly
 * Does NOT regenerate the rest of the brand profile
 * 
 * Fixes: WEATHER_BREAK incorrectly disabled with reasoning "no outdoor seating"
 * Source of Truth: business_operations.has_outdoor_seating = TRUE
 * 
 * Date: June 12, 2026
 */

import { readFileSync } from 'fs';

// Read .env manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Café Faust

console.log('🔄 Regenerating ONLY trigger_configuration (lightweight)...\n');
console.log('📝 Expected fix:');
console.log('   - WEATHER_BREAK.enabled: false → true');
console.log('   - Reasoning: "no outdoor seating" → "outdoor seating by the river"');
console.log('   - business_operations.has_outdoor_seating = TRUE ✅\n');

// Import Supabase
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Note: We can't directly import the Deno module from Node.js
// So we'll make an HTTP request to a wrapper function instead
// For now, let's create a simple Edge Function call

console.log('⚠️  This requires calling the full brand-profile-generator');
console.log('⚠️  Use _regenerate_trigger_config.mjs instead for now\n');
console.log('Alternative: Manual SQL update (see below)\n');

console.log('--- MANUAL SQL UPDATE ---');
console.log(`
UPDATE business_brand_profile
SET 
  trigger_configuration = jsonb_set(
    jsonb_set(
      trigger_configuration,
      '{WEATHER_BREAK,enabled}',
      'true'
    ),
    '{WEATHER_BREAK,reasoning}',
    '"Relevant for outdoor seating by the river - weather drives foot traffic to waterfront location"'
  ),
  trigger_updated_by = 'manual_fix',
  trigger_updated_at = NOW()
WHERE business_id = '${businessId}';
`);

console.log('\n--- OR: Regenerate Full Profile ---');
console.log('Run: node _regenerate_trigger_config.mjs\n');

// Show current state
console.log('🔍 Current trigger_configuration state:\n');

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('trigger_configuration')
  .eq('business_id', businessId)
  .single();

if (error) {
  console.error('❌ Query failed:', error.message);
  process.exit(1);
}

const weatherBreak = data.trigger_configuration?.WEATHER_BREAK;
if (weatherBreak) {
  console.log('🌤️  WEATHER_BREAK:');
  console.log('   Enabled:', weatherBreak.enabled ? '✅ YES' : '❌ NO');
  console.log('   Mode:', weatherBreak.mode);
  console.log('   Reasoning:', weatherBreak.reasoning);
}

const fdWeek = data.trigger_configuration?.FD_WEEK;
if (fdWeek) {
  console.log('\n👨 FD_WEEK (Father\'s Day):');
  console.log('   Enabled:', fdWeek.enabled ? '✅ YES' : '❌ NO');
  console.log('   Reasoning:', fdWeek.reasoning);
}
