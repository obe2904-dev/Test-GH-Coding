#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const envContent = await Deno.readTextFile('.env');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔍 ANALYZING CAFE FAUST SERVICE MODEL\n');
console.log('='.repeat(70));

// Get menu programmes
const { data: programmes } = await supabase
  .from('business_programme_profiles')
  .select('programme_name, programme_type, time_windows, operating_days, is_active')
  .eq('business_id', businessId)
  .eq('is_active', true);

console.log('\n📋 ACTIVE PROGRAMMES:');
programmes?.forEach(p => {
  console.log(`  • ${p.programme_name} (${p.programme_type})`);
  if (p.time_windows) {
    console.log(`    Times: ${JSON.stringify(p.time_windows)}`);
  }
});

// Get menu results to see what food is served when
const { data: menus } = await supabase
  .from('menu_results_v2')
  .select('service_period_name, ai_summary, service_periods')
  .eq('business_id', businessId)
  .eq('status', 'done')
  .limit(10);

console.log('\n🍽️  MENU SERVICE PERIODS:');
const periods = new Set();
menus?.forEach(m => {
  if (m.service_period_name) periods.add(m.service_period_name);
  if (Array.isArray(m.service_periods)) {
    m.service_periods.forEach(p => periods.add(p));
  }
});
console.log('  Service periods found:', Array.from(periods).join(', '));

console.log('\n📝 MENU SUMMARIES:');
menus?.slice(0, 3).forEach(m => {
  console.log(`\n  ${m.service_period_name || 'Unknown'}:`);
  console.log(`  ${m.ai_summary?.substring(0, 200)}...`);
});

// Get opening hours
const { data: hours } = await supabase
  .from('opening_hours')
  .select('weekday, open_time, close_time')
  .eq('business_id', businessId);

console.log('\n⏰ OPENING HOURS:');
hours?.forEach(h => {
  console.log(`  ${h.weekday}: ${h.open_time} - ${h.close_time}`);
});

// Get business character
const { data: profile } = await supabase
  .from('business_brand_profile')
  .select('business_character')
  .eq('business_id', businessId)
  .single();

console.log('\n📖 BUSINESS CHARACTER:');
console.log(`  ${profile?.business_character}`);

console.log('\n' + '='.repeat(70));
console.log('\n🤔 ARCHETYPE ANALYSIS:\n');

const hasBrunch = Array.from(periods).some(p => /brunch/i.test(p));
const hasLunch = Array.from(periods).some(p => /lunch|frokost/i.test(p));
const hasDinner = Array.from(periods).some(p => /dinner|middag|aften/i.test(p));
const hasCocktails = Array.from(periods).some(p => /cocktail|drinks/i.test(p));

console.log(`  Brunch service: ${hasBrunch ? '✅ YES' : '❌ NO'}`);
console.log(`  Lunch service:  ${hasLunch ? '✅ YES' : '❌ NO'}`);
console.log(`  Dinner service: ${hasDinner ? '✅ YES' : '❌ NO'}`);
console.log(`  Bar/Cocktails:  ${hasCocktails ? '✅ YES' : '❌ NO'}`);

// Latest closing time
const latestClose = hours?.reduce((latest, h) => {
  return h.close_time > latest ? h.close_time : latest;
}, '00:00');

console.log(`  Latest closing: ${latestClose}`);

console.log('\n💡 RECOMMENDED ARCHETYPE:\n');

if (hasBrunch && hasLunch && hasDinner) {
  console.log('  → full_service_restaurant');
  console.log('     (Serves brunch, lunch, AND dinner)');
} else if (hasBrunch && hasLunch && !hasDinner && hasCocktails) {
  console.log('  → cafe_bar');
  console.log('     (Day cafe with food, evening bar with drinks)');
  console.log('     BUT: Consider adding "cafe_restaurant_bar" if dinner food is served');
} else if (hasBrunch && hasLunch && !hasDinner) {
  console.log('  → all_day_cafe');
  console.log('     (Morning through afternoon, no dinner kitchen)');
} else {
  console.log('  → cafe_bistro');
  console.log('     (Flexible cafe/bistro service)');
}
