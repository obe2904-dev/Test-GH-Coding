/**
 * Test script to verify content_strategy fallback works
 * 
 * This script:
 * 1. Deletes existing brand profile for Café Faust
 * 2. Regenerates it (triggering the fallback if AI doesn't generate content_strategy)
 * 3. Checks if content_strategy is populated
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUSINESS_ID = 'bb8f4dc5-d091-4906-a0f9-1c9f5cdd6ae2'; // Café Faust

console.log('🧪 Testing content_strategy fallback...\n');

// Step 1: Delete existing brand profile
console.log('Step 1: Deleting existing brand profile...');
const { error: deleteError } = await supabase
  .from('business_brand_profile')
  .delete()
  .eq('business_id', BUSINESS_ID);

if (deleteError) {
  console.error('❌ Delete failed:', deleteError);
  process.exit(1);
}
console.log('✅ Deleted existing brand profile\n');

// Step 2: Wait a moment
await new Promise(resolve => setTimeout(resolve, 2000));

// Step 3: Regenerate brand profile
console.log('Step 2: Regenerating brand profile...');
const response = await fetch(`${supabaseUrl}/functions/v1/brand-profile-generator`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessId: BUSINESS_ID,
    force: true
  })
});

if (!response.ok) {
  const text = await response.text();
  console.error('❌ Generation failed:', response.status, text);
  process.exit(1);
}

const result = await response.json();
console.log('✅ Brand profile regenerated\n');

// Step 4: Wait for DB to update
await new Promise(resolve => setTimeout(resolve, 3000));

// Step 5: Check if content_strategy is populated
console.log('Step 3: Checking content_strategy...');
const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_voice')
  .eq('business_id', BUSINESS_ID)
  .single();

if (error) {
  console.error('❌ Query failed:', error);
  process.exit(1);
}

const contentStrategy = data?.brand_voice?.content_strategy;

if (!contentStrategy) {
  console.error('❌ content_strategy is still NULL');
  console.log('Brand voice keys:', Object.keys(data?.brand_voice || {}));
  process.exit(1);
}

console.log('✅ content_strategy is populated!\n');
console.log('📊 Content Strategy:');
console.log(JSON.stringify(contentStrategy, null, 2));

console.log('\n✨ SUCCESS: content_strategy fallback is working!');
console.log('\nGoal Blend:');
console.log(`  - Drive Footfall: ${contentStrategy.goal_blend.drive_footfall}%`);
console.log(`  - Build Brand: ${contentStrategy.goal_blend.build_brand}%`);
console.log(`  - Retain Loyalty: ${contentStrategy.goal_blend.retain_loyalty}%`);
console.log(`\nPrimary Goal: ${contentStrategy.primary_goal}`);
