#!/usr/bin/env node
/**
 * Regenerate Trigger Configuration for Café Faust
 * 
 * Fixes: WEATHER_BREAK incorrectly disabled with reasoning "no outdoor seating"
 * Source of Truth: business_operations.has_outdoor_seating = TRUE
 * 
 * This calls the full brand-profile-generator which regenerates:
 * - trigger_configuration (Stage CS - Commercial Strategy)
 * - All other brand profile fields
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
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Café Faust

console.log('🔄 Regenerating Brand Profile (includes trigger_configuration)...\n');
console.log('📝 Expected fix:');
console.log('   - WEATHER_BREAK.enabled: false → true');
console.log('   - Reasoning: "no outdoor seating" → "outdoor seating by the river"');
console.log('   - business_operations.has_outdoor_seating = TRUE ✅\n');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/brand-profile-generator`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      businessId: businessId,
      forceRegenerate: true
    })
  }
);

if (!response.ok) {
  const errorText = await response.text();
  console.error('❌ Error:', response.status, response.statusText);
  console.error('Details:', errorText);
  process.exit(1);
}

const result = await response.json();
console.log('✅ Brand profile regenerated successfully!\n');

// Verify the fix
console.log('🔍 Verifying trigger_configuration fix...\n');

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('trigger_configuration, commercial_baseline_mode, commercial_strategy_reasoning')
  .eq('business_id', businessId)
  .single();

if (error) {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
}

console.log('📊 Commercial Strategy Results:');
console.log('   Baseline Mode:', data.commercial_baseline_mode);
console.log('   Reasoning:', data.commercial_strategy_reasoning?.substring(0, 150) + '...');

const weatherBreak = data.trigger_configuration?.WEATHER_BREAK;
if (weatherBreak) {
  console.log('\n🌤️  WEATHER_BREAK Status:');
  console.log('   Enabled:', weatherBreak.enabled ? '✅ YES' : '❌ NO');
  console.log('   Mode:', weatherBreak.mode);
  console.log('   Reasoning:', weatherBreak.reasoning);
  
  if (weatherBreak.enabled) {
    console.log('\n✅✅✅ FIX SUCCESSFUL ✅✅✅');
    console.log('Weather trigger is now correctly enabled for outdoor seating.');
  } else {
    console.log('\n⚠️  WEATHER_BREAK still disabled!');
    console.log('Review reasoning above to understand why.');
  }
} else {
  console.log('\n⚠️  WEATHER_BREAK not found in trigger_configuration');
}

console.log('\n🎯 Next steps:');
console.log('   - Verify other triggers (FD_WEEK may also be affected)');
console.log('   - Monitor when weather trigger logic gets wired into suggestions\n');
