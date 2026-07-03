/**
 * BUSINESS_CHARACTER VALIDATION TESTS
 * 
 * Tests the validation and sanitization functions to ensure:
 * 1. Valid short reasoning is accepted
 * 2. Corrupted persona is rejected
 * 3. Fallback generator produces correct output
 * 4. Context line remains compact
 * 
 * Run: node _test_business_character_validation.mjs
 */

console.log('🧪 BUSINESS_CHARACTER VALIDATION TESTS\n');
console.log('='.repeat(80));

// ============================================================================
// SIMULATE VALIDATION FUNCTIONS (from business-type-detection.ts)
// ============================================================================

function isValidBusinessCharacter(value) {
  if (!value || typeof value !== 'string') return false;
  
  // Check 1: Must be short (< 200 chars)
  if (value.length >= 200) {
    return false;
  }
  
  // Check 2: Must NOT be the persona (starts with "Du er Marketing ekspert")
  if (value.startsWith('Du er Marketing ekspert') || value.startsWith('Du er')) {
    return false;
  }
  
  // Check 3: Must NOT contain multiple sections (FORRETNING:, LOKATION:, etc.)
  if (value.includes('FORRETNING:') || value.includes('LOKATION:')) {
    return false;
  }
  
  return true;
}

function generateFallbackBusinessCharacter(businessType) {
  const fallbacks = {
    'hybrid_cafe': 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)',
    'coffee_bar': 'Specialty coffee terminologi i menu (espresso, flat white, specialty coffee)',
    'wine_bar': 'Bar-program med stort vin-fokus (10+ vin-entries i menu)',
    'cocktail_bar': 'Bar-program med cocktail-fokus (cocktail navne i menu)',
    'fine_dining': 'Fine dining indikatorer i type eller menu (tasting menu, michelin, gastronomisk)',
    'bakery_cafe': 'Bageri-kategori med café-service (morning program)',
    'bistro': 'Bistro i type/kategori eller fransk-inspireret menu',
    'pub': 'Pub i type eller bar med pub-menu (burger, fish & chips, øl)',
    'casual_dining': 'Frokost/middag program uden morgenmad = casual dining',
    'restaurant': 'Standard restaurant uden specifik type-indikator'
  };
  
  return fallbacks[businessType] || fallbacks['restaurant'];
}

function sanitizeBusinessCharacter(value, fallbackType) {
  if (isValidBusinessCharacter(value)) {
    return value;
  }
  
  if (fallbackType) {
    return generateFallbackBusinessCharacter(fallbackType);
  }
  
  return null;
}

// ============================================================================
// TEST DATA
// ============================================================================

const testCases = [
  {
    name: 'Valid short reasoning (hybrid_cafe)',
    input: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)',
    businessType: 'hybrid_cafe',
    expectedValid: true,
    expectedSanitized: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)'
  },
  {
    name: 'Valid short reasoning (coffee_bar)',
    input: 'Specialty coffee terminologi i menu (espresso, flat white, specialty coffee)',
    businessType: 'coffee_bar',
    expectedValid: true,
    expectedSanitized: 'Specialty coffee terminologi i menu (espresso, flat white, specialty coffee)'
  },
  {
    name: 'Corrupted - Full persona (Café Faust actual)',
    input: `Du er Marketing ekspert for Café Faust.

FORRETNING:
Café ved åen i Aarhus med brunch, frokost og aftenmenuer. Frokostservering kl. 09:00-17:30...

LOKATION:
- Åboulevarden 38, 8000 Aarhus`,
    businessType: 'hybrid_cafe',
    expectedValid: false,
    expectedSanitized: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)'
  },
  {
    name: 'Corrupted - Starts with "Du er"',
    input: 'Du er Marketing ekspert for Restaurant X',
    businessType: 'restaurant',
    expectedValid: false,
    expectedSanitized: 'Standard restaurant uden specifik type-indikator'
  },
  {
    name: 'Corrupted - Too long (> 200 chars)',
    input: 'A'.repeat(250),
    businessType: 'bistro',
    expectedValid: false,
    expectedSanitized: 'Bistro i type/kategori eller fransk-inspireret menu'
  },
  {
    name: 'Corrupted - Contains FORRETNING: section',
    input: 'Some text FORRETNING: More details',
    businessType: 'wine_bar',
    expectedValid: false,
    expectedSanitized: 'Bar-program med stort vin-fokus (10+ vin-entries i menu)'
  },
  {
    name: 'Edge case - Empty string',
    input: '',
    businessType: 'pub',
    expectedValid: false,
    expectedSanitized: 'Pub i type eller bar med pub-menu (burger, fish & chips, øl)'
  },
  {
    name: 'Edge case - Null value',
    input: null,
    businessType: 'casual_dining',
    expectedValid: false,
    expectedSanitized: 'Frokost/middag program uden morgenmad = casual dining'
  }
];

// ============================================================================
// RUN TESTS
// ============================================================================

let passCount = 0;
let failCount = 0;

console.log('\n📋 TEST CASES\n');

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(80));
  
  // Test validation
  const isValid = isValidBusinessCharacter(testCase.input);
  const validationPass = isValid === testCase.expectedValid;
  
  console.log(`Input length: ${testCase.input?.length || 0} chars`);
  console.log(`Validation result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Expected: ${testCase.expectedValid ? 'VALID' : 'INVALID'}`);
  console.log(`Validation test: ${validationPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!validationPass) failCount++;
  else passCount++;
  
  // Test sanitization
  const sanitized = sanitizeBusinessCharacter(testCase.input, testCase.businessType);
  const sanitizationPass = sanitized === testCase.expectedSanitized;
  
  console.log(`\nSanitized output: "${sanitized}"`);
  console.log(`Expected output: "${testCase.expectedSanitized}"`);
  console.log(`Sanitization test: ${sanitizationPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!sanitizationPass) failCount++;
  else passCount++;
});

// ============================================================================
// CONTEXT LINE INTEGRATION TEST
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('📊 CONTEXT LINE INTEGRATION TEST');
console.log('='.repeat(80));

const contextLineTests = [
  {
    name: 'Valid short reasoning',
    businessCharacter: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)',
    expectedLine: 'Type: cafe — Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)'
  },
  {
    name: 'Corrupted persona (should be filtered)',
    businessCharacter: `Du er Marketing ekspert for Café Faust.

FORRETNING:
Café ved åen...`,
    expectedLine: 'Type: cafe'
  },
  {
    name: 'Null value (no character shown)',
    businessCharacter: null,
    expectedLine: 'Type: cafe'
  }
];

console.log('\n');

contextLineTests.forEach((test, index) => {
  console.log(`\nContext Line Test ${index + 1}: ${test.name}`);
  console.log('-'.repeat(80));
  
  // Simulate dagens-forslag-prompt-builder logic
  const sanitized = isValidBusinessCharacter(test.businessCharacter) 
    ? test.businessCharacter 
    : null;
  
  const contextLine = `Type: cafe${sanitized ? ` — ${sanitized}` : ''}`;
  
  const pass = contextLine === test.expectedLine;
  
  console.log(`Input: ${test.businessCharacter?.substring(0, 60) || 'null'}...`);
  console.log(`Output: "${contextLine}"`);
  console.log(`Expected: "${test.expectedLine}"`);
  console.log(`Test: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!pass) failCount++;
  else passCount++;
});

// ============================================================================
// FALLBACK GENERATOR TEST
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('🔧 FALLBACK GENERATOR TEST');
console.log('='.repeat(80));

const businessTypes = [
  'hybrid_cafe',
  'coffee_bar',
  'wine_bar',
  'cocktail_bar',
  'fine_dining',
  'bakery_cafe',
  'bistro',
  'pub',
  'casual_dining',
  'restaurant'
];

console.log('\n');

let allFallbacksValid = true;

businessTypes.forEach(type => {
  const fallback = generateFallbackBusinessCharacter(type);
  const isValid = isValidBusinessCharacter(fallback);
  
  console.log(`${type}: "${fallback}"`);
  console.log(`  Length: ${fallback.length} chars, Valid: ${isValid ? '✅' : '❌'}`);
  
  if (!isValid) {
    allFallbacksValid = false;
    failCount++;
  } else {
    passCount++;
  }
});

console.log(`\nAll fallbacks valid: ${allFallbacksValid ? '✅ PASS' : '❌ FAIL'}`);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));

const totalTests = passCount + failCount;
const passRate = ((passCount / totalTests) * 100).toFixed(1);

console.log(`\nTotal tests: ${totalTests}`);
console.log(`Passed: ${passCount} ✅`);
console.log(`Failed: ${failCount} ❌`);
console.log(`Pass rate: ${passRate}%`);

if (failCount === 0) {
  console.log('\n🎉 ALL TESTS PASSED');
  console.log('\n💡 KEY VALIDATIONS:');
  console.log('   • Valid short reasoning accepted');
  console.log('   • Corrupted persona rejected');
  console.log('   • Fallback generator produces valid output');
  console.log('   • Context line remains compact');
  console.log('   • All business types have valid fallbacks');
  console.log('\n🚀 RECOMMENDATION: Deploy validation functions to production');
} else {
  console.log('\n⚠️ SOME TESTS FAILED');
  console.log('   Review failed tests above and fix validation logic');
}

console.log('\n' + '='.repeat(80));
