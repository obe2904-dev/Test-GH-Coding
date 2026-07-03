#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test Calendar System Integration
 * Generates Week 19 strategy for Café Faust and checks for Kr. Himmelfartsdag
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

// Read environment variables (Deno.env is auto-populated from --env-file flag)
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_19_START = '2026-05-11';  // Monday, May 11, 2026
const WEEK_19_END = '2026-05-17';    // Sunday, May 17, 2026

console.log('\n🧪 Testing Calendar System Integration\n');
console.log('='.repeat(60));
console.log('\nBusiness: Café Faust');
console.log('Week: 19 (May 11-17, 2026)');
console.log('Expected: Kr. Himmelfartsdag (Thursday, May 14)');
console.log('\n' + '='.repeat(60) + '\n');

// First, test direct calendar lookup
console.log('Step 1: Testing direct calendar lookup...\n');

const { data: calendarData, error: calendarError } = await supabase
  .rpc('get_week_calendar_context', {
    p_country: 'DK',
    p_city: 'Aarhus',
    p_week_start: WEEK_19_START,
    p_week_end: WEEK_19_END,
  });

if (calendarError) {
  console.error('❌ Calendar lookup failed:', calendarError.message);
  Deno.exit(1);
}

console.log('✅ Calendar data fetched:');
console.log(`   Holidays: ${calendarData.holidays?.length || 0}`);
console.log(`   Local events: ${calendarData.local_events?.length || 0}`);
console.log('');

if (calendarData.holidays && calendarData.holidays.length > 0) {
  console.log('   Week 19 holidays:');
  for (const holiday of calendarData.holidays) {
    console.log(`   • ${holiday.date}: ${holiday.name} (${holiday.name_local})`);
    console.log(`     Retail: ${holiday.retail_impact}, Bridge: ${holiday.typical_bridge_day}, Traffic: ${holiday.hospitality_traffic}`);
  }
  console.log('');
}

// Generate weekly strategy
console.log('Step 2: Generating weekly strategy...\n');

const { data: strategyData, error: strategyError } = await supabase.functions.invoke(
  'get-weekly-strategy',
  {
    body: {
      business_id: CAFE_FAUST_ID,
      week_start: WEEK_19_START,
      week_number: 19,
      regenerate: true,  // Force regeneration to test fresh
      platforms: ['instagram'],
      subscription_tier: 'smart',
    },
  }
);

if (strategyError) {
  console.error('❌ Strategy generation failed:', strategyError.message);
  Deno.exit(1);
}

console.log('✅ Strategy generated successfully\n');

// Check if calendar context was included
const weekContext = (strategyData as any).week_context_snapshot;
if (weekContext?.calendar_context) {
  console.log('   Calendar context in strategy:');
  console.log(`   • Week of month: ${weekContext.calendar_context.week_of_month}`);
  console.log(`   • First weekend: ${weekContext.calendar_context.is_first_weekend}`);
  console.log(`   • Payday week: ${weekContext.calendar_context.is_payday_week}`);
  
  if (weekContext.calendar_context.holidays) {
    console.log(`   • Holidays: ${weekContext.calendar_context.holidays.length}`);
    for (const h of weekContext.calendar_context.holidays) {
      console.log(`     - ${h.date}: ${h.name} (${h.name_local})`);
      console.log(`       Impact: retail=${h.retail_impact}, bridge=${h.typical_bridge_day}, traffic=${h.hospitality_traffic}`);
    }
  }
  
  if (weekContext.calendar_context.local_events) {
    console.log(`   • Local events: ${weekContext.calendar_context.local_events.length}`);
  }
  console.log('');
}

// Check contextual analysis
if ((strategyData as any).contextual_analysis) {
  const analysis = (strategyData as any).contextual_analysis;
  console.log('   Phase 0 contextual analysis:');
  console.log(`   • Key factors: ${analysis.key_factors?.length || 0}`);
  
  if (analysis.key_factors) {
    for (const factor of analysis.key_factors) {
      if (factor.factor_name?.toLowerCase().includes('himmelfart') || 
          factor.factor_name?.toLowerCase().includes('holiday') ||
          factor.factor_name?.toLowerCase().includes('helligdag')) {
        console.log(`   • 🎯 Found holiday factor: "${factor.factor_name}"`);
        console.log(`     Weight: ${factor.strategic_weight}`);
        console.log(`     Impact: ${factor.behavioral_impact}`);
      }
    }
  }
  console.log('');
}

// Check post ideas timing
if ((strategyData as any).post_ideas) {
  const ideas = (strategyData as any).post_ideas;
  console.log(`   Post ideas generated: ${ideas.length}`);
  console.log('   Posting schedule:');
  
  const byDay: Record<string, number> = {};
  for (const idea of ideas) {
    if (idea.suggested_day) {
      const day = new Date(idea.suggested_day + 'T00:00:00').toLocaleDateString('da-DK', { weekday: 'long' });
      byDay[day] = (byDay[day] || 0) + 1;
    }
  }
  
  for (const [day, count] of Object.entries(byDay)) {
    console.log(`   • ${day}: ${count} post(s)`);
  }
  console.log('');
}

console.log('='.repeat(60));
console.log('\n✅ Test completed successfully!\n');
console.log('Key verification points:');
console.log('  1. Calendar data fetched: ✅');
console.log('  2. Kr. Himmelfartsdag detected: ' + (calendarData.holidays?.some((h: any) => h.name.includes('Ascension')) ? '✅' : '❌'));
console.log('  3. Calendar context in strategy: ' + (weekContext?.calendar_context?.holidays ? '✅' : '❌'));
console.log('  4. Strategy generated: ✅\n');
