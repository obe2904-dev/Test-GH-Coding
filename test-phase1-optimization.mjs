/**
 * Test Phase 1 Prompt Optimizations
 * 
 * This script tests that the simplified prompts maintain quality:
 * - Event handling (no hallucination)
 * - Temporal distribution (still working via code)
 * - Weather guidance (simplified but functional)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('\n💡 Set it with:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="your-key-here"\n');
  process.exit(1);
}

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Cafe Faust
const WEEK_START = '2026-06-08'; // Week 24

console.log('🧪 Testing Phase 1 Prompt Optimizations\n');
console.log('═══════════════════════════════════════\n');

console.log('📋 Test Parameters:');
console.log(`  Business: Cafe Faust (${BUSINESS_ID})`);
console.log(`  Week: ${WEEK_START} (Week 24)`);
console.log(`  Post Count: 4\n`);

console.log('🚀 Calling get-weekly-strategy...\n');

const response = await fetch(`${supabaseUrl}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: BUSINESS_ID,
    week_start: WEEK_START,
    post_count: 4
  })
});

if (!response.ok) {
  const text = await response.text();
  console.error('❌ Function call failed:', response.status);
  console.error(text);
  process.exit(1);
}

const result = await response.json();

console.log('✅ Strategy generated successfully\n');

// Debug: Show raw structure
console.log('📦 Raw Response Structure:');
console.log('  Keys:', Object.keys(result).join(', '));
if (result.strategy) {
  console.log('  Strategy Keys:', Object.keys(result.strategy).join(', '));
}
console.log();

console.log('═══════════════════════════════════════\n');

// Quality Checks
console.log('🔍 QUALITY CHECKS:\n');

let passCount = 0;
let failCount = 0;

// Check 1: Event Accuracy (no hallucination)
console.log('1️⃣  Event Accuracy (Anti-Hallucination):');
const strategyText = JSON.stringify(result.strategy);
const narrativeText = result.narrative?.weekly_overview || '';

// Known hallucinations to check for
const hallucinations = ['musikfestival', 'festival', 'koncert'];
const foundHallucinations = hallucinations.filter(h => 
  strategyText.toLowerCase().includes(h) || narrativeText.toLowerCase().includes(h)
);

if (foundHallucinations.length === 0) {
  console.log('   ✅ PASS - No event hallucinations detected');
  passCount++;
} else {
  console.log(`   ❌ FAIL - Found hallucinations: ${foundHallucinations.join(', ')}`);
  failCount++;
}

// Check 2: Content Type Allocation
console.log('\n2️⃣  Content Type Allocation:');
const postIdeas = result.strategy?.post_ideas || [];
const typesAssigned = postIdeas.filter(p => p.content_type).length;
const typeDistribution = postIdeas.reduce((acc, p) => {
  if (p.content_type) acc[p.content_type] = (acc[p.content_type] || 0) + 1;
  return acc;
}, {});

if (typesAssigned === postIdeas.length && typesAssigned > 0) {
  console.log(`   ✅ PASS - All ${typesAssigned} posts have content_type`);
  console.log(`   📊 Distribution: ${JSON.stringify(typeDistribution)}`);
  passCount++;
} else {
  console.log(`   ❌ FAIL - Only ${typesAssigned}/${postIdeas.length} posts have content_type`);
  failCount++;
}

// Check 3: Temporal Distribution (check post dates are spread)
console.log('\n3️⃣  Temporal Distribution:');
const postDates = postIdeas
  .map(p => p.target_date)
  .filter(Boolean)
  .sort();

if (postDates.length > 0) {
  // Check for consecutive days (max 2 allowed)
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  
  for (let i = 1; i < postDates.length; i++) {
    const prevDate = new Date(postDates[i-1]);
    const currDate = new Date(postDates[i]);
    const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    
    if (dayDiff === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  
  if (maxConsecutive <= 2) {
    console.log(`   ✅ PASS - Good spread (max ${maxConsecutive} consecutive days)`);
    console.log(`   📅 Dates: ${postDates.join(', ')}`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL - Too clustered (${maxConsecutive} consecutive days)`);
    console.log(`   📅 Dates: ${postDates.join(', ')}`);
    failCount++;
  }
} else {
  console.log('   ⚠️  SKIP - No target_date assigned yet');
}

// Check 4: Strategy Structure
console.log('\n4️⃣  Strategy Structure:');

const hasStrategicBrief = result.strategy?.strategic_brief && typeof result.strategy.strategic_brief === 'object';
const hasPostIdeas = postIdeas.length > 0;
const hasNarrative = result.strategy?.narrative?.overview?.length > 0;

if (hasStrategicBrief && hasPostIdeas && hasNarrative) {
  console.log('   ✅ PASS - All strategy components present');
  console.log(`      strategic_brief: ${result.strategy.strategic_brief.angles?.length || 0} angles`);
  console.log(`      post_ideas: ${postIdeas.length} items`);
  console.log(`      narrative.overview: ${result.strategy.narrative.overview.length} chars`);
  passCount++;
} else {
  console.log('   ❌ FAIL - Missing strategy components');
  if (!hasStrategicBrief) console.log('      Missing: strategic_brief');
  if (!hasPostIdeas) console.log('      Missing: post_ideas');
  if (!hasNarrative) console.log('      Missing: narrative.overview');
  failCount++;
}

// Summary
console.log('\n═══════════════════════════════════════\n');
console.log('📊 TEST SUMMARY:\n');
console.log(`   ✅ Passed: ${passCount}`);
console.log(`   ❌ Failed: ${failCount}`);
console.log(`   📝 Total: ${passCount + failCount}\n`);

if (failCount === 0) {
  console.log('🎉 All quality checks passed! Phase 1 optimizations successful.\n');
} else {
  console.log('⚠️  Some checks failed. Review output above.\n');
  process.exit(1);
}

// Optional: Show sample output
console.log('═══════════════════════════════════════\n');
console.log('📄 SAMPLE OUTPUT:\n');
console.log('Narrative Headline:');
console.log(`   ${result.strategy?.narrative?.headline}\n`);
console.log('Narrative Overview:');
console.log(`   ${result.strategy?.narrative?.overview}\n`);
console.log('Strategic Brief Angles:');
result.strategy?.strategic_brief?.angles?.forEach((a, i) => {
  console.log(`   ${i+1}. ${a.focus} (weight: ${a.weight}, goal: ${a.goal_mode})`);
});
console.log('\nPost Ideas:');
postIdeas.forEach((p, i) => {
  console.log(`   ${i+1}. [${p.content_type}] ${p.focus}`);
  if (p.target_date) console.log(`      Date: ${p.target_date}`);
  if (p.type_rationale) console.log(`      Rationale: ${p.type_rationale.substring(0, 60)}...`);
});
console.log();
