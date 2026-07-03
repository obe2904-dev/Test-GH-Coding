#!/usr/bin/env node

/**
 * Check for slot_id patterns and angle_focus matching
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

console.log('\n=== Phase 2a Fixes Validation ===\n');

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, post_ideas')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', 26)
  .single();

if (error || !data) {
  console.error('Error:', error);
  Deno.exit(1);
}

const angles = data.strategic_brief.angles || [];
const posts = data.post_ideas || [];

console.log('--- Strategic Brief Angles ---\n');
angles.forEach((angle, i) => {
  console.log(`Angle ${i + 1}:`);
  console.log(`  Focus: "${angle.focus}"`);
  console.log(`  Slot ID: ${angle.slot_id}`);
  console.log(`  Weight: ${Math.round(angle.weight * 100)}%`);
  console.log(`  Goal Mode: ${angle.goal_mode}`);
  console.log();
});

console.log('--- Test 1: Legacy Slot ID Patterns ---\n');
const hasLegacy = angles.some(a => a.slot_id?.includes('_exp'));
if (hasLegacy) {
  console.log('❌ FAIL: Found legacy _exp pattern');
  angles.filter(a => a.slot_id?.includes('_exp')).forEach(a => {
    console.log(`  - ${a.slot_id}: "${a.focus}"`);
  });
} else {
  console.log('✅ PASS: No legacy _exp patterns found');
  console.log(`   Slot IDs used: ${angles.map(a => a.slot_id).join(', ')}`);
}

console.log('\n--- Test 2: Angle Focus Matching ---\n');
const angleFocuses = new Set(angles.map(a => a.focus));
let matchErrors = 0;

posts.forEach((post, i) => {
  const exactMatch = angles.find(a => a.focus === post.angle_focus);
  const fuzzyMatch = angles.find(a => 
    a.focus.toLowerCase().includes(post.angle_focus.toLowerCase()) ||
    post.angle_focus.toLowerCase().includes(a.focus.toLowerCase())
  );
  
  if (!exactMatch && !fuzzyMatch) {
    console.log(`❌ Post ${i + 1}: "${post.angle_focus}"`);
    console.log(`   → No match in strategic brief`);
    console.log(`   → Using slot_id: ${post.slot_id}`);
    matchErrors++;
  } else if (!exactMatch && fuzzyMatch) {
    console.log(`⚠️  Post ${i + 1}: "${post.angle_focus}"`);
    console.log(`   → Fuzzy match: "${fuzzyMatch.focus}"`);
    console.log(`   → Slot ID: ${post.slot_id} (expected: ${fuzzyMatch.slot_id})`);
  }
});

if (matchErrors === 0) {
  console.log('✅ All posts matched to strategic angles');
} else {
  console.log(`\n❌ ${matchErrors} posts failed to match`);
}

console.log('\n--- Test 3: Weight Distribution ---\n');
const anglePostCounts = angles.map(a => ({
  focus: a.focus,
  slot_id: a.slot_id,
  weight: a.weight,
  expected: Math.round(a.weight * posts.length),
  actual: posts.filter(p => {
    // Match by exact focus first
    const exact = a.focus === p.angle_focus;
    // Or by slot_id as fallback
    const bySlot = a.slot_id === p.slot_id;
    return exact || bySlot;
  }).length
}));

anglePostCounts.forEach(a => {
  const match = a.expected === a.actual ? '✅' : '⚠️';
  console.log(`${match} "${a.focus.substring(0, 50)}..."`);
  console.log(`   Weight: ${Math.round(a.weight * 100)}% → Expected ${a.expected} posts, got ${a.actual}`);
});

console.log('\n--- Test 4: Slot Count Validation ---\n');
const totalExpected = posts.length;
const totalFromAngles = angles.length;

console.log(`Target posts: ${totalExpected}`);
console.log(`Strategic angles: ${totalFromAngles}`);
console.log(`Post ideas generated: ${posts.length}`);

if (angles.length >= posts.length) {
  console.log('✅ PASS: Enough angles for all posts');
} else {
  console.log('❌ FAIL: Not enough angles - would trigger legacy expansion');
}

console.log('\n=== Summary ===\n');
console.log(`1. Legacy patterns: ${hasLegacy ? '❌ FOUND' : '✅ CLEAN'}`);
console.log(`2. Angle matching: ${matchErrors > 0 ? '⚠️ ISSUES' : '✅ GOOD'}`);
console.log(`3. Count validation: ${angles.length >= posts.length ? '✅ PASS' : '❌ FAIL'}`);
console.log();
