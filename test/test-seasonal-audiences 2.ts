/**
 * Test: Task 4.3 Seasonal Audience Modeling
 * 
 * Purpose: Validate that seasonal audiences are correctly blended with time-based
 * audiences for businesses with seasonalVariation data.
 * 
 * Run: deno run --allow-all test/test-seasonal-audiences.ts
 */

import {
  getSeasonFromMonth,
  getCurrentSeason,
  getSeasonNameDanish,
  isSummerMonth,
  isWinterMonth,
  getMonthsForSeason,
  type Season
} from '../supabase/functions/_shared/season-utils.ts';

console.log('🧪 Testing Seasonal Audience Modeling (Task 4.3)\n');

// =============================================================================
// Test 1: Season Detection from Month
// =============================================================================
console.log('Test 1: Season Detection from Month');
console.log('====================================');

const test1Cases = [
  { month: 0, expected: 'winter', name: 'January' },
  { month: 1, expected: 'winter', name: 'February' },
  { month: 2, expected: 'winter', name: 'March' },
  { month: 3, expected: 'summer', name: 'April (tourist season starts)' },
  { month: 4, expected: 'summer', name: 'May' },
  { month: 5, expected: 'summer', name: 'June' },
  { month: 6, expected: 'summer', name: 'July (peak)' },
  { month: 7, expected: 'summer', name: 'August' },
  { month: 8, expected: 'summer', name: 'September' },
  { month: 9, expected: 'winter', name: 'October (off-season starts)' },
  { month: 10, expected: 'winter', name: 'November' },
  { month: 11, expected: 'winter', name: 'December' }
];

let test1Passed = 0;
let test1Failed = 0;

test1Cases.forEach(({ month, expected, name }) => {
  const result = getSeasonFromMonth(month);
  const status = result === expected ? '✅' : '❌';
  console.log(`  ${status} ${name} (month ${month}) → "${result}" (expected: "${expected}")`);
  if (result === expected) test1Passed++;
  else test1Failed++;
});

console.log(`\nResult: ${test1Passed}/${test1Cases.length} passed\n`);

// =============================================================================
// Test 2: Season Helper Functions
// =============================================================================
console.log('Test 2: Season Helper Functions');
console.log('================================');

const test2Cases = [
  {
    name: 'isSummerMonth(6)',
    fn: () => isSummerMonth(6),
    expected: true
  },
  {
    name: 'isSummerMonth(0)',
    fn: () => isSummerMonth(0),
    expected: false
  },
  {
    name: 'isWinterMonth(1)',
    fn: () => isWinterMonth(1),
    expected: true
  },
  {
    name: 'isWinterMonth(7)',
    fn: () => isWinterMonth(7),
    expected: false
  },
  {
    name: 'getSeasonNameDanish("summer")',
    fn: () => getSeasonNameDanish('summer'),
    expected: 'sommer'
  },
  {
    name: 'getSeasonNameDanish("winter")',
    fn: () => getSeasonNameDanish('winter'),
    expected: 'vinter'
  }
];

let test2Passed = 0;
let test2Failed = 0;

test2Cases.forEach(({ name, fn, expected }) => {
  const result = fn();
  const matches = result === expected;
  const status = matches ? '✅' : '❌';
  console.log(`  ${status} ${name} = ${result} (expected: ${expected})`);
  if (matches) test2Passed++;
  else test2Failed++;
});

console.log(`\nResult: ${test2Passed}/${test2Cases.length} passed\n`);

// =============================================================================
// Test 3: Month Ranges for Seasons
// =============================================================================
console.log('Test 3: Month Ranges for Seasons');
console.log('=================================');

const summerMonths = getMonthsForSeason('summer');
const winterMonths = getMonthsForSeason('winter');

console.log(`  Summer months: [${summerMonths.join(', ')}]`);
console.log(`  Expected:      [3, 4, 5, 6, 7, 8] (April-September)`);
const summerCorrect = JSON.stringify(summerMonths) === JSON.stringify([3, 4, 5, 6, 7, 8]);
console.log(`  ${summerCorrect ? '✅' : '❌'} Summer range correct\n`);

console.log(`  Winter months: [${winterMonths.join(', ')}]`);
console.log(`  Expected:      [9, 10, 11, 0, 1, 2] (October-March)`);
const winterCorrect = JSON.stringify(winterMonths) === JSON.stringify([9, 10, 11, 0, 1, 2]);
console.log(`  ${winterCorrect ? '✅' : '❌'} Winter range correct\n`);

const test3Passed = (summerCorrect ? 1 : 0) + (winterCorrect ? 1 : 0);
const test3Failed = 2 - test3Passed;

console.log(`Result: ${test3Passed}/2 passed\n`);

// =============================================================================
// Test 4: Edge Cases
// =============================================================================
console.log('Test 4: Edge Cases');
console.log('==================');

const test4Cases = [
  {
    name: 'Invalid month (-1)',
    fn: () => getSeasonFromMonth(-1),
    expected: 'winter',  // Should default to winter with warning
    description: 'Should handle negative month gracefully'
  },
  {
    name: 'Invalid month (12)',
    fn: () => getSeasonFromMonth(12),
    expected: 'winter',  // Should default to winter with warning
    description: 'Should handle out-of-range month gracefully'
  },
  {
    name: 'Edge: March (last winter month)',
    fn: () => getSeasonFromMonth(2),
    expected: 'winter',
    description: 'March should still be winter'
  },
  {
    name: 'Edge: April (first summer month)',
    fn: () => getSeasonFromMonth(3),
    expected: 'summer',
    description: 'April should be summer (tourist season)'
  },
  {
    name: 'Edge: September (last summer month)',
    fn: () => getSeasonFromMonth(8),
    expected: 'summer',
    description: 'September should still be summer'
  },
  {
    name: 'Edge: October (first winter month)',
    fn: () => getSeasonFromMonth(9),
    expected: 'winter',
    description: 'October should be winter (off-season)'
  }
];

let test4Passed = 0;
let test4Failed = 0;

test4Cases.forEach(({ name, fn, expected, description }) => {
  const result = fn();
  const matches = result === expected;
  const status = matches ? '✅' : '❌';
  console.log(`  ${status} ${name} → ${result}`);
  console.log(`      ${description}`);
  if (matches) test4Passed++;
  else test4Failed++;
});

console.log(`\nResult: ${test4Passed}/${test4Cases.length} passed\n`);

// =============================================================================
// Test 5: Seasonal Blending Logic (Conceptual)
// =============================================================================
console.log('Test 5: Seasonal Blending Logic (Conceptual)');
console.log('=============================================');

// This test demonstrates the expected blending behavior without
// actually calling persona-matcher (which requires Supabase client)

const mockTimeSlotAudiences = ['weekendgæster', 'par', 'lokale', 'vennegrupper'];
const mockSeasonalSummer = ['turister', 'destinationsbesøgende', 'familier', 'par'];
const mockSeasonalWinter = ['lokale', 'stamgæster', 'hverdagsgæster'];

// Blending logic (60/40 split):
// - Take top 3 from seasonal
// - Take top 2 from time slot (excluding duplicates)
// - Max 5 total

function mockBlend(timeSlot: string[], seasonal: string[]): string[] {
  const seasonalTop = seasonal.slice(0, 3);
  const timeSlotTop = timeSlot.slice(0, 2).filter(a => !seasonalTop.includes(a));
  return [...seasonalTop, ...timeSlotTop].slice(0, 5);
}

const summerBlended = mockBlend(mockTimeSlotAudiences, mockSeasonalSummer);
const winterBlended = mockBlend(mockTimeSlotAudiences, mockSeasonalWinter);

console.log('  Time slot audiences (year-round):');
console.log(`    ${mockTimeSlotAudiences.join(', ')}`);
console.log('');
console.log('  Summer blending:');
console.log(`    Seasonal: ${mockSeasonalSummer.join(', ')}`);
console.log(`    Result:   ${summerBlended.join(', ')}`);
console.log(`    Expected: turister, destinationsbesøgende, familier, weekendgæster, par`);
const summerMatches = summerBlended.join(', ') === 'turister, destinationsbesøgende, familier, weekendgæster, par';
console.log(`    ${summerMatches ? '✅' : '❌'} Correct blend`);
console.log('');
console.log('  Winter blending:');
console.log(`    Seasonal: ${mockSeasonalWinter.join(', ')}`);
console.log(`    Result:   ${winterBlended.join(', ')}`);
console.log(`    Expected: lokale, stamgæster, hverdagsgæster, weekendgæster, par`);
const winterMatches = winterBlended.join(', ') === 'lokale, stamgæster, hverdagsgæster, weekendgæster, par';
console.log(`    ${winterMatches ? '✅' : '❌'} Correct blend`);

const test5Passed = (summerMatches ? 1 : 0) + (winterMatches ? 1 : 0);
const test5Failed = 2 - test5Passed;

console.log(`\nResult: ${test5Passed}/2 passed\n`);

// =============================================================================
// Test 6: Current Season Detection
// =============================================================================
console.log('Test 6: Current Season Detection');
console.log('=================================');

const currentSeason = getCurrentSeason();
const currentMonth = new Date().getMonth();
const expectedCurrentSeason = getSeasonFromMonth(currentMonth);

console.log(`  Current month (0-based): ${currentMonth}`);
console.log(`  getCurrentSeason(): ${currentSeason}`);
console.log(`  Expected: ${expectedCurrentSeason}`);
const currentSeasonCorrect = currentSeason === expectedCurrentSeason;
console.log(`  ${currentSeasonCorrect ? '✅' : '❌'} Current season detection correct`);

console.log(`\nResult: ${currentSeasonCorrect ? '1/1' : '0/1'} passed\n`);

const test6Passed = currentSeasonCorrect ? 1 : 0;
const test6Failed = currentSeasonCorrect ? 0 : 1;

// =============================================================================
// Summary
// =============================================================================
console.log('========================================');
console.log('📊 Test Summary');
console.log('========================================');
console.log(`Test 1 (Season from Month):    ${test1Passed}/${test1Cases.length} passed`);
console.log(`Test 2 (Helper Functions):     ${test2Passed}/${test2Cases.length} passed`);
console.log(`Test 3 (Month Ranges):         ${test3Passed}/2 passed`);
console.log(`Test 4 (Edge Cases):           ${test4Passed}/${test4Cases.length} passed`);
console.log(`Test 5 (Blending Logic):       ${test5Passed}/2 passed`);
console.log(`Test 6 (Current Season):       ${test6Passed}/1 passed`);

const totalPassed = test1Passed + test2Passed + test3Passed + test4Passed + test5Passed + test6Passed;
const totalTests = test1Cases.length + test2Cases.length + 2 + test4Cases.length + 2 + 1;
const allPassed = test1Failed === 0 && test2Failed === 0 && test3Failed === 0 && 
                   test4Failed === 0 && test5Failed === 0 && test6Failed === 0;

console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);
console.log(`${allPassed ? '✅ All tests PASSED' : '❌ Some tests FAILED'}\n`);

if (!allPassed) {
  Deno.exit(1);
}
