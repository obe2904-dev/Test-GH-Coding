#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_NUMBER = 19;

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('post_ideas, strategic_brief')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('week_number', WEEK_NUMBER)
  .order('generated_at', { ascending: false })
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error.message);
  Deno.exit(1);
}

console.log('\n📅 WEEK 19 POST SCHEDULE\n');
console.log('='.repeat(80) + '\n');

const dayNames: Record<number, string> = {
  0: 'Søndag', 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 
  4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag',
};

// Sort by date
const sorted = (data.post_ideas || []).sort((a: any, b: any) => 
  a.suggested_day.localeCompare(b.suggested_day)
);

for (const post of sorted) {
  const date = new Date(post.suggested_day + 'T12:00:00');
  const dow = date.getDay();
  const dayName = dayNames[dow];
  const dateStr = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  
  const isHoliday = post.suggested_day === '2026-05-14';
  const isBridge = post.suggested_day === '2026-05-15';
  
  console.log(`${isHoliday ? '🎯' : isBridge ? '🌉' : '📌'} ${dayName} ${dateStr}${isHoliday ? ' (Kr. Himmelfartsdag)' : ''}${isBridge ? ' (Klemmedag)' : ''}`);
  console.log(`   Slot: ${post.slot_id || 'undefined'}`);
  console.log(`   Title: ${post.title || 'Untitled'}`);
  console.log(`   Category: ${post.content_category || 'N/A'}`);
  console.log(`   Goal: ${post.goal_mode || 'N/A'}`);
  
  if (post.cta_instruction) {
    console.log(`   CTA: ${post.cta_instruction.substring(0, 150)}...`);
  }
  
  console.log('');
}

console.log('='.repeat(80));
console.log('\n📊 STRATEGIC BRIEF TIMING\n');

if (data.strategic_brief?.angles) {
  for (const angle of data.strategic_brief.angles) {
    console.log(`Slot ${angle.slot_id}: ${angle.timing_window || 'No timing'}`);
    console.log(`  Focus: ${angle.focus}`);
    console.log(`  Days: ${angle.suggested_days?.join(', ') || 'N/A'}`);
    console.log('');
  }
}
