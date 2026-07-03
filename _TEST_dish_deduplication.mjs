/**
 * Test script for dish deduplication logic
 * Validates that the same base dish doesn't appear twice with different modifiers
 * 
 * Run with: node _TEST_dish_deduplication.mjs
 */

// Helper: Extract core dish name (before modifiers)
function extractCoreDish(name) {
  const lowerName = name.toLowerCase().trim();
  const modifiers = [' med ', ' with ', ' på ', ' i ', ' af ', ' og ', ' and ', ','];
  for (const mod of modifiers) {
    const parts = lowerName.split(mod);
    if (parts.length > 1) {
      return parts[0].trim();
    }
  }
  return lowerName;
}

// Helper: Extract significant words (4+ chars)
function extractSignificantWords(name) {
  const genericModifiers = ['klassisk', 'classic', 'dagens', 'today', 'vores', 'fresh'];
  return new Set(
    name.toLowerCase()
      .replace(/[^\wæøåéüö\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4)
      .filter(w => !genericModifiers.includes(w))
  );
}

// Check if a dish is a duplicate of any used dishes
function isDuplicate(dishName, usedDishes) {
  const nameLower = dishName.toLowerCase().trim();
  const itemCore = extractCoreDish(nameLower);
  const itemWords = extractSignificantWords(itemCore);
  
  return usedDishes.some(used => {
    const usedLower = used.toLowerCase().trim();
    
    // 1. Exact match
    if (usedLower === nameLower) {
      return true;
    }
    
    // 2. Full substring match
    if (usedLower.includes(nameLower) || nameLower.includes(usedLower)) {
      return true;
    }
    
    // 3. Core dish name matching
    const usedCore = extractCoreDish(usedLower);
    const usedWords = extractSignificantWords(usedCore);
    
    const sharedWords = [...itemWords].filter(w => usedWords.has(w));
    
    if (sharedWords.length >= 2 || (sharedWords.length === 1 && sharedWords[0].length >= 6)) {
      console.log(`  ✅ DUPLICATE: "${dishName}" matches "${used}" (shared: ${sharedWords.join(', ')})`);
      return true;
    }
    
    return false;
  });
}

// Test cases
console.log('🧪 Testing Dish Deduplication Logic\n');

console.log('Test 1: Same base dish with different modifiers (SHOULD BLOCK)');
const used1 = ['Klassisk pariserbøf med æggeblomme'];
const test1 = 'Pariserbøf med rødbeder';
const result1 = isDuplicate(test1, used1);
console.log(`  Used: ${used1[0]}`);
console.log(`  Testing: ${test1}`);
console.log(`  Result: ${result1 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (bug!)'}\n`);

console.log('Test 2: Exact match (SHOULD BLOCK)');
const used2 = ['Laksesalat'];
const test2 = 'Laksesalat';
const result2 = isDuplicate(test2, used2);
console.log(`  Used: ${used2[0]}`);
console.log(`  Testing: ${test2}`);
console.log(`  Result: ${result2 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (bug!)'}\n`);

console.log('Test 3: Different dishes with similar words (SHOULD ALLOW)');
const used3 = ['Laksesalat med dild'];
const test3 = 'Laksetartar med kapers';
const result3 = isDuplicate(test3, used3);
console.log(`  Used: ${used3[0]}`);
console.log(`  Testing: ${test3}`);
console.log(`  Result: ${result3 ? '❌ BLOCKED (bug!)' : '✅ ALLOWED (correct!)'}\n`);

console.log('Test 4: Substring match (SHOULD BLOCK)');
const used4 = ['Dagens suppe'];
const test4 = 'Dagens';
const result4 = isDuplicate(test4, used4);
console.log(`  Used: ${used4[0]}`);
console.log(`  Testing: ${test4}`);
console.log(`  Result: ${result4 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (bug!)'}\n`);

console.log('Test 5: Similar but distinct dishes (SHOULD ALLOW)');
const used5 = ['Græsk salat'];
const test5 = 'Cæsar salat';
const result5 = isDuplicate(test5, used5);
console.log(`  Used: ${used5[0]}`);
console.log(`  Testing: ${test5}`);
console.log(`  Result: ${result5 ? '❌ BLOCKED (bug!)' : '✅ ALLOWED (correct!)'}\n`);

console.log('Test 6: Multiple used dishes, checking against all');
const used6 = ['Klassisk omelet med sprød bacon', 'Klassisk pariserbøf med æggeblomme'];
const test6 = 'Pariserbøf med rødbeder';
const result6 = isDuplicate(test6, used6);
console.log(`  Used: ${used6.join(', ')}`);
console.log(`  Testing: ${test6}`);
console.log(`  Result: ${result6 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (bug!)'}\n`);

console.log('Test 7: Compound dish names (SHOULD BLOCK)');
const used7 = ['Frikadeller med kartoffelsalat'];
const test7 = 'Frikadeller med ærter';
const result7 = isDuplicate(test7, used7);
console.log(`  Used: ${used7[0]}`);
console.log(`  Testing: ${test7}`);
console.log(`  Result: ${result7 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (bug!)'}\n`);

// Summary
const tests = [
  { name: 'Same base dish', expected: true, actual: result1 },
  { name: 'Exact match', expected: true, actual: result2 },
  { name: 'Different dishes', expected: false, actual: result3 },
  { name: 'Substring match', expected: true, actual: result4 },
  { name: 'Similar but distinct', expected: false, actual: result5 },
  { name: 'Multiple used dishes', expected: true, actual: result6 },
  { name: 'Compound dish names', expected: true, actual: result7 }
];

const passed = tests.filter(t => t.expected === t.actual).length;
const failed = tests.filter(t => t.expected !== t.actual).length;

console.log('═══════════════════════════════════════════');
console.log(`SUMMARY: ${passed}/${tests.length} tests passed`);
if (failed > 0) {
  console.log(`\n❌ Failed tests:`);
  tests.filter(t => t.expected !== t.actual).forEach(t => {
    console.log(`  - ${t.name}: Expected ${t.expected ? 'BLOCK' : 'ALLOW'}, got ${t.actual ? 'BLOCK' : 'ALLOW'}`);
  });
} else {
  console.log('✅ All tests passed!');
}
console.log('═══════════════════════════════════════════');
