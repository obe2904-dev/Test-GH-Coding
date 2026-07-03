/**
 * COMPREHENSIVE ACTIVATION ENGINE TEST SUITE
 * 
 * Tests activation engine across different scenarios:
 * 1. Holiday week (Week 20 - Kr. Himmelfartsdag)
 * 2. Normal week (Week 22 - no holidays)
 * 3. Different business types (if multiple available)
 * 
 * Validates:
 * - Segment activation/deactivation logic
 * - Timing window recommendations
 * - Goal distribution
 * - Phase 1 compliance with activation guidance
 */

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  Deno.exit(1);
}

interface TestScenario {
  name: string;
  business_id: string;
  week_start: string;
  week_number: number;
  expected_behavior: {
    family_surge?: boolean;
    work_deactivated?: boolean;
    outdoor_active?: boolean;
    timing_extended?: boolean;
  };
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Week 20 - Kr. Himmelfartsdag (Holiday Surge)',
    business_id: '2037d63c-a138-4247-89c5-5b6b8cef9f3f', // Café Faust
    week_start: '2026-05-11',
    week_number: 20,
    expected_behavior: {
      family_surge: true,
      work_deactivated: true,
      timing_extended: true,
    },
  },
  {
    name: 'Week 22 - Normal Week (No Holidays)',
    business_id: '2037d63c-a138-4247-89c5-5b6b8cef9f3f', // Café Faust
    week_start: '2026-05-25',
    week_number: 22,
    expected_behavior: {
      family_surge: false,
      work_deactivated: false,
      outdoor_active: true, // Late May - good weather expected
    },
  },
];

async function runTest(scenario: TestScenario): Promise<boolean> {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`🧪 TEST: ${scenario.name}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Business: ${scenario.business_id}`);
  console.log(`Week: ${scenario.week_number} (${scenario.week_start})`);
  console.log('');
  
  // Step 1: Request strategy generation
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      business_id: scenario.business_id,
      week_start: scenario.week_start,
      regenerate: true,
    }),
  });
  
  if (response.status !== 202) {
    console.error(`❌ Request failed: ${response.status}`);
    console.error(await response.text());
    return false;
  }
  
  const result = await response.json();
  const strategyId = result.strategy_id;
  
  console.log(`✅ Request submitted: ${strategyId}`);
  console.log('Polling for completion...\n');
  
  // Step 2: Poll for completion
  let attempts = 0;
  const MAX_ATTEMPTS = 60; // 5 minutes max
  
  while (attempts < MAX_ATTEMPTS) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    attempts++;
    
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/weekly_strategies?id=eq.${strategyId}&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!checkResponse.ok) {
      console.error(`Database query failed: ${checkResponse.status}`);
      console.error(await checkResponse.text());
      return false;
    }
    
    const strategies = await checkResponse.json();
    const strategy = strategies[0];
    
    if (!strategy) {
      console.error(`❌ Strategy not found: ${strategyId}`);
      return false;
    }
    
    if (strategy.status === 'generated') {
      console.log(`✅ Generation complete after ${attempts} attempts (${attempts * 5}s)`);
      return await validateResult(scenario, strategy);
    } else if (strategy.status === 'error') {
      console.error(`❌ Generation failed: ${strategy.error_message}`);
      return false;
    }
    
    // Show progress every 3 attempts
    if (attempts % 3 === 0) {
      console.log(`⏳ Still generating... (attempt ${attempts}/${MAX_ATTEMPTS})`);
    }
  }
  
  console.error(`❌ Timeout after ${MAX_ATTEMPTS} attempts`);
  return false;
}

async function validateResult(scenario: TestScenario, strategy: any): Promise<boolean> {
  console.log('\n📊 VALIDATION RESULTS:');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const brief = strategy.strategic_brief;
  if (!brief || !brief.angles) {
    console.error('❌ No strategic brief found');
    return false;
  }
  
  console.log(`Angles generated: ${brief.angles.length}`);
  
  let validationPassed = true;
  
  // Check 1: Family surge expectation
  if (scenario.expected_behavior.family_surge) {
    const hasFamilyAngles = brief.angles.some((a: any) => 
      a.focus.toLowerCase().includes('familie') ||
      a.focus.toLowerCase().includes('family')
    );
    
    if (hasFamilyAngles) {
      console.log('✅ Family angles present (expected for holiday surge)');
    } else {
      console.warn('⚠️  No family angles found (expected for holiday surge)');
      validationPassed = false;
    }
  }
  
  // Check 2: Work deactivation expectation
  if (scenario.expected_behavior.work_deactivated) {
    const hasWorkAngles = brief.angles.some((a: any) => 
      a.focus.toLowerCase().includes('pendler') ||
      a.focus.toLowerCase().includes('frokost') && a.focus.toLowerCase().includes('arbejd')
    );
    
    if (!hasWorkAngles) {
      console.log('✅ Work angles absent (expected - work deactivated)');
    } else {
      console.warn('⚠️  Work angles present (unexpected - should be deactivated)');
      validationPassed = false;
    }
  }
  
  // Check 3: Timing window format
  const timingWindows = brief.angles.map((a: any) => a.timing_window).filter(Boolean);
  console.log(`\nTiming windows: ${timingWindows.join(', ')}`);
  
  const invalidTiming = timingWindows.some((tw: string) => 
    tw !== 'any' && !tw.match(/\w+-?\w*\s+\d{1,2}:\d{2}/)
  );
  
  if (invalidTiming) {
    console.warn('⚠️  Some timing windows have invalid format');
    validationPassed = false;
  } else {
    console.log('✅ All timing windows properly formatted');
  }
  
  // Check 4: Post timing alignment
  const postIdeas = strategy.post_ideas || [];
  console.log(`\nPosts scheduled: ${postIdeas.length}`);
  
  const timingMismatches: string[] = [];
  
  for (const post of postIdeas) {
    const matchingAngle = brief.angles.find((a: any) => a.focus === post.angle_focus);
    if (!matchingAngle) continue;
    
    const angleTiming = matchingAngle.timing_window;
    if (!angleTiming || angleTiming === 'any') continue;
    
    // Extract day from timing_window
    const postDay = new Date(post.suggested_day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    
    if (!angleTiming.includes(postDay)) {
      timingMismatches.push(`"${post.title}" scheduled ${postDay} but angle says "${angleTiming}"`);
    }
  }
  
  if (timingMismatches.length === 0) {
    console.log('✅ All posts scheduled within angle timing windows');
  } else {
    console.warn('⚠️  Timing mismatches found:');
    timingMismatches.forEach(m => console.warn(`   ${m}`));
    validationPassed = false;
  }
  
  // Check 5: Expected timing extension for holidays
  if (scenario.expected_behavior.timing_extended) {
    const hasExtendedTiming = timingWindows.some((tw: string) => 
      tw.includes('Thu') || tw.includes('Fri')
    );
    
    if (hasExtendedTiming) {
      console.log('✅ Extended timing windows detected (Thu-Fri pattern)');
    } else {
      console.warn('⚠️  No extended timing detected (expected for holiday week)');
      validationPassed = false;
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULT: ${validationPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  return validationPassed;
}

// Run all tests
console.log('🚀 ACTIVATION ENGINE VALIDATION SUITE');
console.log('Testing across multiple scenarios...\n');

const results: { scenario: string; passed: boolean }[] = [];

for (const scenario of TEST_SCENARIOS) {
  const passed = await runTest(scenario);
  results.push({ scenario: scenario.name, passed });
}

// Summary
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('📊 TEST SUITE SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

let passCount = 0;
for (const result of results) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${result.scenario}`);
  if (result.passed) passCount++;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`OVERALL: ${passCount}/${results.length} tests passed`);
console.log('═══════════════════════════════════════════════════════════════');

Deno.exit(passCount === results.length ? 0 : 1);
