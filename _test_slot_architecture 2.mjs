#!/usr/bin/env node

/**
 * Test new slot-based architecture with Week 27
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
const TEST_WEEK = 27;

console.log('\n=== Testing New Slot Architecture (Week 27) ===\n');

// Delete cache
console.log('🗑️  Deleting existing Week 27 cache...');
await supabase.from('weekly_content_plans').delete().eq('business_id', BUSINESS_ID).eq('week_number', TEST_WEEK);
await supabase.from('weekly_strategies').delete().eq('business_id', BUSINESS_ID).eq('week_number', TEST_WEEK);
console.log('✅ Cache cleared\n');

// Generate strategy
console.log('🎯 Generating strategy with new slot architecture...');
const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    business_id: BUSINESS_ID,
    week_number: TEST_WEEK,
    year: 2025,
  }),
});

if (!response.ok) {
  const error = await response.text();
  console.error('❌ Error:', error);
  Deno.exit(1);
}

const result = await response.json();
console.log('✅ Strategy generated:', result.strategy_id, '\n');

// Fetch and validate
const { data } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, post_ideas')
  .eq('id', result.strategy_id)
  .single();

const angles = data.strategic_brief?.angles || [];
const posts = data.post_ideas || [];

console.log('═══════════════════════════════════════════════════════════\n');
console.log('📊 SLOT STRUCTURE VALIDATION\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Total strategic slots: ${angles.length}`);
console.log(`Total post ideas: ${posts.length}`);
console.log();

// Check if using new slot format
const hasNewFormat = angles.every(a => typeof a.slot_id === 'number');
const hasStrategicIntent = angles.every(a => a.strategic_intent !== undefined);

console.log('🏗️  Architecture Format:');
console.log(`   Numeric slot IDs: ${hasNewFormat ? '✅ YES (new format)' : '❌ NO (legacy format)'}`);
console.log(`   Strategic intent field: ${hasStrategicIntent ? '✅ YES' : '⚠️ NO'}`);
console.log();

console.log('═══════════════════════════════════════════════════════════\n');
console.log('🎯 SLOT DETAILS\n');
console.log('═══════════════════════════════════════════════════════════\n');

angles.forEach((slot, idx) => {
  console.log(`\n🔹 SLOT ${slot.slot_id || idx + 1}`);
  console.log(`   Strategic Intent: ${slot.strategic_intent || slot.focus}`);
  console.log(`   Goal Mode: ${slot.goal_mode}`);
  console.log(`   CTA Mode: ${slot.cta_mode || 'not set'}`);
  console.log(`   Target Days: ${JSON.stringify(slot.target_days || 'not set')}`);
  console.log(`   Target Service: ${slot.target_service_period || 'not set'}`);
  console.log(`   Content Focus: ${slot.content_focus || 'not set'}`);
  
  // Find matching posts
  const matchingPosts = posts.filter(p => {
    // Try new format (slot_id) or legacy format (angle_focus)
    return (p.slot_id !== undefined && p.slot_id === slot.slot_id) ||
           (p.angle_focus === slot.focus || p.angle_focus === slot.strategic_intent);
  });
  
  console.log(`   Matching Posts: ${matchingPosts.length}`);
  if (matchingPosts.length > 0) {
    matchingPosts.forEach((post, i) => {
      console.log(`      Post ${i + 1}: ${post.title}`);
      console.log(`         Day: ${post.suggested_day}, Type: ${post.content_type}`);
      console.log(`         Timing Intelligence: ${post.timing_intelligence ? '✅ YES' : '❌ NO'}`);
    });
  }
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('✅ VALIDATION RESULTS\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Validate 1:1 mapping
const is1to1 = angles.length === posts.length && posts.length === 4;
console.log(`1:1 Slot-to-Post mapping: ${is1to1 ? '✅ PASS' : '❌ FAIL'}`);

// Check for legacy patterns
const hasLegacyExpansion = angles.some(a => a.slot_id?.toString().includes('_exp'));
const hasNumberedDuplicates = posts.some(p => p.angle_focus?.includes('(2)') || p.angle_focus?.includes('(3)'));
console.log(`No legacy _exp patterns: ${!hasLegacyExpansion ? '✅ PASS' : '❌ FAIL'}`);
console.log(`No numbered duplicates: ${!hasNumberedDuplicates ? '✅ PASS' : '❌ FAIL'}`);

// Check slot ID tracking
const allPostsHaveSlotId = posts.every(p => p.slot_id !== undefined);
console.log(`All posts have slot_id: ${allPostsHaveSlotId ? '✅ PASS' : '⚠️ PARTIAL'}`);

// Check timing intelligence
const allPostsHaveTiming = posts.every(p => p.timing_intelligence !== null);
console.log(`All posts have timing intelligence: ${allPostsHaveTiming ? '✅ PASS' : '⚠️ PARTIAL'}`);

console.log('\n═══════════════════════════════════════════════════════════\n');

if (is1to1 && !hasLegacyExpansion && !hasNumberedDuplicates && hasNewFormat) {
  console.log('🎉 SUCCESS: New slot architecture is working!\n');
  Deno.exit(0);
} else {
  console.log('⚠️  ATTENTION: Some validation checks failed. Review above.\n');
  Deno.exit(1);
}
