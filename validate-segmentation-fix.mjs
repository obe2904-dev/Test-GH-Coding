/**
 * Quick Validation Script
 * 
 * Run this to validate the audience segmentation fix is working correctly.
 * This script checks that the new architecture is in place without requiring
 * a full OpenAI API call.
 * 
 * Usage:
 *   deno run --allow-read validate-segmentation-fix.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('Audience Segmentation Fix — Validation');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let allChecksPassed = true;

// Check 1: location-strategy.ts has demographic_proximity_signals
console.log('✓ Check 1: location-strategy.ts has new signal architecture');
try {
  const locationStrategyPath = join(__dirname, 'supabase/functions/_shared/brand-profile/location-strategy.ts');
  const locationStrategy = readFileSync(locationStrategyPath, 'utf8');
  
  if (!locationStrategy.includes('DemographicProximitySignal')) {
    console.log('  ❌ FAIL: Missing DemographicProximitySignal interface');
    allChecksPassed = false;
  } else {
    console.log('  ✅ DemographicProximitySignal interface found');
  }
  
  if (!locationStrategy.includes('demographic_proximity_signals')) {
    console.log('  ❌ FAIL: Missing demographic_proximity_signals field');
    allChecksPassed = false;
  } else {
    console.log('  ✅ demographic_proximity_signals field found');
  }
  
  if (!locationStrategy.includes('generateDemographicProximitySignals')) {
    console.log('  ❌ FAIL: Missing generateDemographicProximitySignals function');
    allChecksPassed = false;
  } else {
    console.log('  ✅ generateDemographicProximitySignals function found');
  }
  
  if (!locationStrategy.includes('cityCentreScore >= 80')) {
    console.log('  ❌ FAIL: Missing tourist caveat logic for high city_centre');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Tourist caveat logic found');
  }
} catch (error) {
  console.log('  ❌ FAIL: Could not read location-strategy.ts');
  console.log(`  Error: ${error.message}`);
  allChecksPassed = false;
}
console.log('');

// Check 2: audience-profile.ts has three-section prompt
console.log('✓ Check 2: audience-profile.ts has three-section architecture');
try {
  const audienceProfilePath = join(__dirname, 'supabase/functions/_shared/brand-profile/audience-profile.ts');
  const audienceProfile = readFileSync(audienceProfilePath, 'utf8');
  
  if (!audienceProfile.includes('concept_fit_reason')) {
    console.log('  ❌ FAIL: Missing concept_fit_reason field');
    allChecksPassed = false;
  } else {
    console.log('  ✅ concept_fit_reason field found');
  }
  
  if (!audienceProfile.includes('FORMAT_OCCASION_SIGNALS')) {
    console.log('  ❌ FAIL: Missing FORMAT_OCCASION_SIGNALS constant');
    allChecksPassed = false;
  } else {
    console.log('  ✅ FORMAT_OCCASION_SIGNALS constant found');
  }
  
  if (!audienceProfile.includes('detectProgrammeFormat')) {
    console.log('  ❌ FAIL: Missing detectProgrammeFormat function');
    allChecksPassed = false;
  } else {
    console.log('  ✅ detectProgrammeFormat function found');
  }
  
  if (!audienceProfile.includes('SEKTION A — FORRETNINGSKONCEPT')) {
    console.log('  ❌ FAIL: Missing Section A (Business Concept) in prompt');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Section A (Business Concept) found');
  }
  
  if (!audienceProfile.includes('SEKTION B — STEDSFAKTA')) {
    console.log('  ❌ FAIL: Missing Section B (Location Facts) in prompt');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Section B (Location Facts) found');
  }
  
  if (!audienceProfile.includes('SEKTION C — ANLEDNINGSLOGIK')) {
    console.log('  ❌ FAIL: Missing Section C (Occasion Logic) in prompt');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Section C (Occasion Logic) found');
  }
  
  if (!audienceProfile.includes('buildDemographicProximitySignalsSection')) {
    console.log('  ❌ FAIL: Missing buildDemographicProximitySignalsSection function');
    allChecksPassed = false;
  } else {
    console.log('  ✅ buildDemographicProximitySignalsSection function found');
  }
  
  // Check that old constraint-based function is removed
  if (audienceProfile.includes('buildReachableDemographicsSection(')) {
    console.log('  ⚠️  WARNING: Old buildReachableDemographicsSection function still exists');
    console.log('     (Should be replaced with buildDemographicProximitySignalsSection)');
  }
  
} catch (error) {
  console.log('  ❌ FAIL: Could not read audience-profile.ts');
  console.log(`  Error: ${error.message}`);
  allChecksPassed = false;
}
console.log('');

// Check 3: Validation includes concept_fit_reason check
console.log('✓ Check 3: Validation requires concept_fit_reason');
try {
  const audienceProfilePath = join(__dirname, 'supabase/functions/_shared/brand-profile/audience-profile.ts');
  const audienceProfile = readFileSync(audienceProfilePath, 'utf8');
  
  if (!audienceProfile.includes('concept_fit_reason missing or too short')) {
    console.log('  ❌ FAIL: Validation does not check for concept_fit_reason');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Validation checks for concept_fit_reason');
  }
} catch (error) {
  console.log('  ❌ FAIL: Could not validate concept_fit_reason check');
  console.log(`  Error: ${error.message}`);
  allChecksPassed = false;
}
console.log('');

// Check 4: Test file exists
console.log('✓ Check 4: Test suite exists');
try {
  const testPath = join(__dirname, 'supabase/functions/_shared/brand-profile/__tests__/audience-segmentation-fix.test.ts');
  const testFile = readFileSync(testPath, 'utf8');
  
  if (!testFile.includes('K-BBQ')) {
    console.log('  ❌ FAIL: K-BBQ test case not found');
    allChecksPassed = false;
  } else {
    console.log('  ✅ K-BBQ test case found');
  }
  
  if (!testFile.includes('Café Faust') && !testFile.includes('Cafe Faust')) {
    console.log('  ❌ FAIL: Café Faust test case not found');
    allChecksPassed = false;
  } else {
    console.log('  ✅ Café Faust test case found');
  }
} catch (error) {
  console.log('  ⚠️  WARNING: Test file not found or could not be read');
  console.log(`  Error: ${error.message}`);
}
console.log('');

// Final summary
console.log('═══════════════════════════════════════════════════════════════════════');
if (allChecksPassed) {
  console.log('✅ ALL CHECKS PASSED');
  console.log('');
  console.log('The audience segmentation fix has been successfully implemented.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Deploy to development environment');
  console.log('2. Test with K-BBQ Silkeborg case');
  console.log('3. Verify tourists are NOT primary segment');
  console.log('4. Verify concept_fit_reason references both format and location');
  console.log('5. Monitor first 10 businesses for segment quality');
} else {
  console.log('❌ SOME CHECKS FAILED');
  console.log('');
  console.log('Please review the errors above and ensure all changes are in place.');
}
console.log('═══════════════════════════════════════════════════════════════════════');

process.exit(allChecksPassed ? 0 : 1);
