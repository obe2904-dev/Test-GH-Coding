#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test Week 19 Post Scheduling
 * Verifies that calendar system fixes the Monday/Sunday timing problem
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_19_START = '2026-05-11';

console.log('\n🧪 Testing Week 19 Post Scheduling\n');
console.log('='.repeat(70));
console.log('\n📍 Café Faust - Week 19 (May 11-17, 2026)');
console.log('🎯 Expected: Posts on Wed/Thu/Fri (not Mon/Sun)');
console.log('🎯 Expected: Kr. Himmelfartsdag (Thu May 14) awareness in CTAs\n');
console.log('='.repeat(70) + '\n');

// Generate fresh strategy
console.log('Step 1: Generating fresh Week 19 strategy...\n');

const { data: strategyData, error: strategyError } = await supabase.functions.invoke(
  'get-weekly-strategy',
  {
    body: {
      business_id: CAFE_FAUST_ID,
      week_start: WEEK_19_START,
      week_number: 19,
      regenerate: true,
      platforms: ['instagram'],
      subscription_tier: 'smart',
    },
  }
);

if (strategyError) {
  console.error('❌ Strategy generation failed:', strategyError);
  Deno.exit(1);
}

console.log('✅ Strategy generated\n');

// Analyze post scheduling
const postIdeas = (strategyData as any).post_ideas || [];
console.log('='.repeat(70));
console.log('📅 POST SCHEDULING ANALYSIS');
console.log('='.repeat(70) + '\n');

if (postIdeas.length === 0) {
  console.error('❌ No post ideas generated!');
  Deno.exit(1);
}

// Group by day
const dayMap = new Map<string, any[]>();
const dayNames: Record<number, string> = {
  0: 'Søndag',
  1: 'Mandag',
  2: 'Tirsdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lørdag',
};

for (const idea of postIdeas) {
  if (!idea.suggested_day) continue;
  
  const date = new Date(idea.suggested_day + 'T12:00:00');
  const dow = date.getDay();
  const dayName = dayNames[dow];
  const dateStr = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const key = `${dayName} ${dateStr}`;
  
  if (!dayMap.has(key)) dayMap.set(key, []);
  dayMap.get(key)!.push(idea);
}

// Display schedule
console.log(`📊 Total posts: ${postIdeas.length}\n`);
console.log('Posting schedule:\n');

const sortedDays = Array.from(dayMap.entries()).sort((a, b) => {
  const dateA = new Date(a[1][0].suggested_day + 'T12:00:00');
  const dateB = new Date(b[1][0].suggested_day + 'T12:00:00');
  return dateA.getTime() - dateB.getTime();
});

for (const [dayKey, ideas] of sortedDays) {
  const date = ideas[0].suggested_day;
  const isHoliday = date === '2026-05-14';
  const isBridgeDay = date === '2026-05-15';
  const emoji = isHoliday ? '🎯' : isBridgeDay ? '🌉' : '📌';
  
  console.log(`${emoji} ${dayKey}: ${ideas.length} post(s)${isHoliday ? ' ← Kr. Himmelfartsdag' : ''}${isBridgeDay ? ' ← Bridge day' : ''}`);
  
  for (const idea of ideas) {
    console.log(`   • Slot ${idea.slot_id}: ${idea.title || idea.angle_focus || 'Untitled'}`);
  }
  console.log('');
}

// Check for problematic days
console.log('='.repeat(70));
console.log('✅ VERIFICATION CHECKS');
console.log('='.repeat(70) + '\n');

const hasMonday = postIdeas.some((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 1);
const hasSunday = postIdeas.some((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 0);
const hasWednesday = postIdeas.some((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 3);
const hasThursday = postIdeas.some((p: any) => p.suggested_day === '2026-05-14');
const hasFriday = postIdeas.some((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 5);

console.log(`❌ Posts on Monday (bad):    ${hasMonday ? '⚠️  YES - PROBLEM!' : '✅ NO'}`);
console.log(`❌ Posts on Sunday (bad):    ${hasSunday ? '⚠️  YES - PROBLEM!' : '✅ NO'}`);
console.log(`✅ Posts on Wednesday (good): ${hasWednesday ? '✅ YES' : '❌ NO - MISSING!'}`);
console.log(`✅ Posts on Thursday (good):  ${hasThursday ? '✅ YES' : '❌ NO - MISSING HOLIDAY!'}`);
console.log(`✅ Posts on Friday (good):    ${hasFriday ? '✅ YES' : '❌ NO - MISSING BRIDGE DAY!'}`);

console.log('\n');

// Analyze CTA content
console.log('='.repeat(70));
console.log('🎯 CTA & HOLIDAY AWARENESS ANALYSIS');
console.log('='.repeat(70) + '\n');

const thursdayPosts = postIdeas.filter((p: any) => p.suggested_day === '2026-05-14');
const fridayPosts = postIdeas.filter((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 5 && p.suggested_day === '2026-05-15');
const wednesdayPosts = postIdeas.filter((p: any) => new Date(p.suggested_day + 'T12:00:00').getDay() === 3);

if (thursdayPosts.length > 0) {
  console.log('📌 Thursday (Kr. Himmelfartsdag) posts:\n');
  for (const post of thursdayPosts) {
    console.log(`   Slot ${post.slot_id}: ${post.title || 'Untitled'}`);
    console.log(`   CTA instruction: ${post.cta_instruction || 'No CTA'}`);
    
    const mentionsHoliday = (post.cta_instruction || '').toLowerCase().includes('himmelfart') ||
                            (post.cta_instruction || '').toLowerCase().includes('helligdag');
    const mentionsSurge = (post.cta_instruction || '').toLowerCase().includes('fyldt') ||
                         (post.cta_instruction || '').toLowerCase().includes('travlt') ||
                         (post.cta_instruction || '').toLowerCase().includes('butikker lukket');
    
    console.log(`   ${mentionsHoliday ? '✅' : '❌'} Mentions holiday: ${mentionsHoliday ? 'YES' : 'NO'}`);
    console.log(`   ${mentionsSurge ? '✅' : '❌'} Mentions surge/closed stores: ${mentionsSurge ? 'YES' : 'NO'}`);
    console.log('');
  }
} else {
  console.log('⚠️  NO THURSDAY POSTS - Major problem!\n');
}

if (fridayPosts.length > 0) {
  console.log('📌 Friday (Bridge day) posts:\n');
  for (const post of fridayPosts) {
    console.log(`   Slot ${post.slot_id}: ${post.title || 'Untitled'}`);
    console.log(`   CTA instruction: ${post.cta_instruction || 'No CTA'}`);
    
    const mentionsBridgeDay = (post.cta_instruction || '').toLowerCase().includes('klemme') ||
                              (post.cta_instruction || '').toLowerCase().includes('bridge') ||
                              (post.cta_instruction || '').toLowerCase().includes('mange har fri');
    
    console.log(`   ${mentionsBridgeDay ? '✅' : '❌'} Mentions bridge day: ${mentionsBridgeDay ? 'YES' : 'NO'}`);
    console.log('');
  }
}

if (wednesdayPosts.length > 0) {
  console.log('📌 Wednesday (Advance) posts:\n');
  for (const post of wednesdayPosts) {
    console.log(`   Slot ${post.slot_id}: ${post.title || 'Untitled'}`);
    console.log(`   CTA instruction: ${post.cta_instruction || 'No CTA'}`);
    
    const mentionsUpcoming = (post.cta_instruction || '').toLowerCase().includes('i morgen') ||
                            (post.cta_instruction || '').toLowerCase().includes('torsdag');
    
    console.log(`   ${mentionsUpcoming ? '✅' : '⚠️ '} Mentions upcoming Thursday: ${mentionsUpcoming ? 'YES' : 'NO'}`);
    console.log('');
  }
}

// Final verdict
console.log('='.repeat(70));
console.log('📊 FINAL VERDICT');
console.log('='.repeat(70) + '\n');

const scheduleFixed = !hasMonday && !hasSunday && hasWednesday && hasThursday && hasFriday;
const holidayAware = thursdayPosts.some((p: any) => 
  (p.cta_instruction || '').toLowerCase().includes('himmelfart')
);

console.log(`Scheduling fixed:     ${scheduleFixed ? '✅ YES' : '❌ NO'}`);
console.log(`Holiday aware:        ${holidayAware ? '✅ YES' : '❌ NO'}`);
console.log(`Posts on surge days:  ${hasThursday && hasFriday ? '✅ YES' : '❌ NO'}`);

if (scheduleFixed && holidayAware) {
  console.log('\n🎉 SUCCESS! Calendar system working as expected!');
} else {
  console.log('\n⚠️  ISSUES DETECTED - Review results above');
}

console.log('\n');
