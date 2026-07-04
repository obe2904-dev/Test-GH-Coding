#!/usr/bin/env node

/**
 * Force fresh week 26 generation with new Phase 2a code
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
const TEST_WEEK = 26;

console.log('\n=== Regenerating Week 26 with New Code ===\n');

// Delete cache
console.log('Deleting cache...');
await supabase.from('weekly_content_plans').delete().eq('business_id', BUSINESS_ID).eq('week_number', TEST_WEEK);
await supabase.from('weekly_strategies').delete().eq('business_id', BUSINESS_ID).eq('week_number', TEST_WEEK);
console.log('✓ Cache cleared\n');

// Generate strategy
console.log('Generating strategy...');
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
console.log('✓ Generated:', result.strategy_id, '\n');

// Fetch and validate
const { data } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, post_ideas')
  .eq('id', result.strategy_id)
  .single();

const angles = data.strategic_brief?.angles || [];
const posts = data.post_ideas || [];

console.log('--- Results ---\n');
console.log(`Strategic angles: ${angles.length}`);
console.log(`Post ideas: ${posts.length}`);
console.log();

angles.forEach((a, i) => {
  const postCount = posts.filter(p => 
    p.angle_focus === a.focus || p.slot_id === a.slot_id
  ).length;
  const expected = Math.round(a.weight * posts.length);
  const status = postCount === expected ? '✅' : postCount > 0 ? '⚠️' : '❌';
  
  console.log(`${status} Angle ${i + 1}: "${a.focus.substring(0, 60)}..."`);
  console.log(`   Slot: ${a.slot_id}, Weight: ${Math.round(a.weight * 100)}%, Goal: ${a.goal_mode}`);
  console.log(`   Expected ${expected} posts, got ${postCount}`);
  console.log();
});

console.log('--- Validation ---\n');
const hasLegacy = angles.some(a => a.slot_id?.includes('_exp'));
const hasExpanded = posts.some(p => p.angle_focus?.includes('(2)') || p.angle_focus?.includes('(3)'));

console.log(`1. Legacy _exp patterns: ${hasLegacy ? '❌ FOUND' : '✅ NONE'}`);
console.log(`2. Numbered duplicates (revenue distribution): ${hasExpanded ? '✅ FOUND' : '⚠️ NONE'}`);
console.log(`3. Angle count matches post count: ${angles.length >= posts.length ? '✅ YES' : '❌ NO'}`);
console.log();
