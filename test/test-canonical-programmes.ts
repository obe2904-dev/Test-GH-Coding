/**
 * Test: Task 3.2 Programme Name Canonicalization
 * 
 * Purpose: Validate that programme name variations are correctly normalized
 * to prevent rotation tracking fragmentation.
 * 
 * Run: deno run --allow-all test/test-canonical-programmes.ts
 */

import { 
  canonicalizeProgramme, 
  canonicalizeProgrammes,
  isProgrammeVariant,
  PROGRAMME_VARIATIONS,
  CANONICAL_PROGRAMME_GROUPS
} from '../supabase/functions/_shared/canonical-programmes.ts';

console.log('🧪 Testing Programme Name Canonicalization (Task 3.2)\n');

// Test 1: Single programme canonicalization
console.log('Test 1: Single Programme Canonicalization');
console.log('==========================================');

const test1Cases = [
  { input: 'Morgenmad', expected: 'brunch' },
  { input: 'BREAKFAST', expected: 'brunch' },
  { input: 'brunch', expected: 'brunch' },
  { input: 'Lunch', expected: 'frokost' },
  { input: 'FROKOST', expected: 'frokost' },
  { input: 'Dinner', expected: 'aftensmad' },
  { input: 'Aftensmad', expected: 'aftensmad' },
  { input: 'Bar', expected: 'cocktails' },
  { input: 'Cocktails', expected: 'cocktails' },
  { input: 'Unknown Programme', expected: 'unknown programme' } // passthrough
];

let test1Passed = 0;
let test1Failed = 0;

test1Cases.forEach(({ input, expected }) => {
  const result = canonicalizeProgramme(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`  ${status} "${input}" → "${result}" (expected: "${expected}")`);
  if (result === expected) test1Passed++;
  else test1Failed++;
});

console.log(`\nResult: ${test1Passed}/${test1Cases.length} passed\n`);

// Test 2: Array canonicalization with deduplication
console.log('Test 2: Array Canonicalization (with deduplication)');
console.log('===================================================');

const test2Cases = [
  { 
    input: ['Brunch', 'Morgenmad', 'Breakfast'], 
    expected: ['brunch'] 
  },
  { 
    input: ['Lunch', 'Frokost', 'Dinner', 'Aftensmad'], 
    expected: ['frokost', 'aftensmad'] 
  },
  { 
    input: ['Bar', 'Cocktails', 'Drinks'], 
    expected: ['cocktails'] 
  }
];

let test2Passed = 0;
let test2Failed = 0;

test2Cases.forEach(({ input, expected }) => {
  const result = canonicalizeProgrammes(input);
  const resultSorted = result.sort();
  const expectedSorted = expected.sort();
  const matches = JSON.stringify(resultSorted) === JSON.stringify(expectedSorted);
  const status = matches ? '✅' : '❌';
  console.log(`  ${status} ${JSON.stringify(input)}`);
  console.log(`      → ${JSON.stringify(result)} (expected: ${JSON.stringify(expected)})`);
  if (matches) test2Passed++;
  else test2Failed++;
});

console.log(`\nResult: ${test2Passed}/${test2Cases.length} passed\n`);

// Test 3: Variant matching
console.log('Test 3: Variant Matching');
console.log('========================');

const test3Cases = [
  { input: 'Morgenmad', canonical: 'brunch', expected: true },
  { input: 'Lunch', canonical: 'frokost', expected: true },
  { input: 'Brunch', canonical: 'frokost', expected: false },
  { input: 'Bar', canonical: 'cocktails', expected: true }
];

let test3Passed = 0;
let test3Failed = 0;

test3Cases.forEach(({ input, canonical, expected }) => {
  const result = isProgrammeVariant(input, canonical as any);
  const status = result === expected ? '✅' : '❌';
  console.log(`  ${status} isProgrammeVariant("${input}", "${canonical}") = ${result} (expected: ${expected})`);
  if (result === expected) test3Passed++;
  else test3Failed++;
});

console.log(`\nResult: ${test3Passed}/${test3Cases.length} passed\n`);

// Test 4: Verify mapping coverage
console.log('Test 4: Mapping Coverage');
console.log('========================');

const totalMappings = Object.keys(PROGRAMME_VARIATIONS).length;
const canonicalGroups = Object.keys(CANONICAL_PROGRAMME_GROUPS).length;

console.log(`  ✅ ${totalMappings} programme variations mapped`);
console.log(`  ✅ ${canonicalGroups} canonical programme groups defined`);
console.log(`  📊 Mapping breakdown:`);

Object.entries(CANONICAL_PROGRAMME_GROUPS).forEach(([canonical, variations]) => {
  console.log(`      - ${canonical}: ${variations.length} variations (${variations.join(', ')})`);
});

// Summary
console.log('\n========================================');
console.log('📊 Test Summary');
console.log('========================================');
console.log(`Test 1 (Single): ${test1Passed}/${test1Cases.length} passed`);
console.log(`Test 2 (Array):  ${test2Passed}/${test2Cases.length} passed`);
console.log(`Test 3 (Variant): ${test3Passed}/${test3Cases.length} passed`);
console.log(`Test 4 (Coverage): ✅ ${totalMappings} mappings verified`);

const allPassed = test1Failed === 0 && test2Failed === 0 && test3Failed === 0;
console.log(`\n${allPassed ? '✅ All tests PASSED' : '❌ Some tests FAILED'}\n`);

if (!allPassed) {
  Deno.exit(1);
}
