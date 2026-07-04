#!/usr/bin/env node

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

const { data } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, post_ideas')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', 26)
  .single();

const angles = data.strategic_brief.angles;
const posts = data.post_ideas;

console.log('\n=== Detailed Post Distribution ===\n');

posts.forEach((post, i) => {
  const matchingAngle = angles.find(a => a.focus === post.angle_focus || a.slot_id === post.slot_id);
  
  console.log(`Post ${i + 1}: "${post.title}"`);
  console.log(`  angle_focus: "${post.angle_focus}"`);
  console.log(`  slot_id: ${post.slot_id}`);
  console.log(`  goal_mode: ${post.goal_mode}`);
  
  if (matchingAngle) {
    const match = matchingAngle.focus === post.angle_focus ? 'EXACT' : 'BY SLOT_ID';
    console.log(`  ✓ Matched (${match}): "${matchingAngle.focus.substring(0, 50)}..." (${Math.round(matchingAngle.weight * 100)}%)`);
  } else {
    console.log(`  ❌ NO MATCH FOUND`);
  }
  console.log();
});

console.log('--- Distribution Summary ---\n');

angles.forEach((angle, i) => {
  const exactMatches = posts.filter(p => p.angle_focus === angle.focus);
  const slotMatches = posts.filter(p => p.slot_id === angle.slot_id);
  
  console.log(`Angle ${i + 1}: "${angle.focus.substring(0, 60)}..."`);
  console.log(`  Slot: ${angle.slot_id}, Weight: ${Math.round(angle.weight * 100)}%`);
  console.log(`  Exact focus matches: ${exactMatches.length}`);
  console.log(`  Slot ID matches: ${slotMatches.length}`);
  console.log(`  Expected posts: ${Math.round(angle.weight * posts.length)}`);
  console.log();
});
