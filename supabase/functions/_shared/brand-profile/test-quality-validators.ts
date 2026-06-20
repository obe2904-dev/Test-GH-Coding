/**
 * Test Suite for Quality Validators
 * 
 * Run sanity checks to ensure validation logic is working correctly.
 */

import { runValidationSanityChecks, validateBrandEssenceQuality } from './quality-validators.ts'

// Run sanity checks
console.log('=== QUALITY VALIDATORS SANITY CHECKS ===\n')

const sanityCheckResults = runValidationSanityChecks()

console.log(`Overall: ${sanityCheckResults.passed ? '✅ PASS' : '❌ FAIL'}\n`)

for (const result of sanityCheckResults.results) {
  const icon = result.expected === result.actual ? '✅' : '❌'
  console.log(`${icon} ${result.test}`)
  console.log(`   Expected: ${result.expected ? 'PASS' : 'FAIL'}`)
  console.log(`   Actual: ${result.actual ? 'PASS' : 'FAIL'}`)
  
  if (result.details && result.details.length > 0) {
    console.log(`   Errors detected:`)
    for (const error of result.details) {
      console.log(`     - ${error}`)
    }
  }
  console.log('')
}

// Additional manual tests
console.log('=== ADDITIONAL VALIDATION TESTS ===\n')

// Test waterfront sound violation
const waterfrontBad = "Café ved åen i Aarhus — nyd lyden af åen mens du slapper af."
const waterfrontTest = validateBrandEssenceQuality(waterfrontBad, {
  location: {
    enrichment: {
      micro: {
        area_type: 'waterfront',
        waterfront_term: 'ved åen'
      }
    }
  }
} as any)

console.log('Test: Waterfront sound violation (river/canal)')
console.log(`Result: ${waterfrontTest.passed ? '✅ PASS' : '❌ FAIL (expected)'}`)
if (waterfrontTest.details.sensoryGrounding.physicalRealityViolations.length > 0) {
  console.log('Physical reality violations detected:')
  for (const violation of waterfrontTest.details.sensoryGrounding.physicalRealityViolations) {
    console.log(`  - "${violation.detail}": ${violation.violation}`)
  }
}
console.log('')

// Test good emotional positioning
const goodEmotional = "Det velfortjente stop ved åen — kaffe om morgenen når du skal have starten på dagen, drinks når du skal have det godt om aftenen."
const emotionalTest = validateBrandEssenceQuality(goodEmotional)

console.log('Test: Good emotional positioning')
console.log(`Result: ${emotionalTest.passed ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Emotional score: ${emotionalTest.details.emotionalPositioning.score}/10`)
console.log(`Emotional signals: ${emotionalTest.details.emotionalPositioning.emotionalSignals.join(', ')}`)
console.log(`Operational signals: ${emotionalTest.details.emotionalPositioning.operationalSignals.join(', ')}`)
if (emotionalTest.errors.length > 0) {
  console.log('Errors:')
  for (const error of emotionalTest.errors) {
    console.log(`  - ${error}`)
  }
}
console.log('')

// Test actual Café Faust brand_essence from database (April 29, 2026)
const cafeFaustActual = "Café, restaurant og bar ved åen i Aarhus — brunch og frokost til aftensmad og drinks, alle ugens dage."
const cafeFaustTest = validateBrandEssenceQuality(cafeFaustActual)

console.log('Test: Actual Café Faust brand_essence (from database)')
console.log(`Text: "${cafeFaustActual}"`)
console.log(`Result: ${cafeFaustTest.passed ? '✅ PASS' : '❌ FAIL (should fail - operational language)'}`)
console.log(`Emotional score: ${cafeFaustTest.details.emotionalPositioning.score}/10`)
console.log(`Forbidden patterns: ${cafeFaustTest.details.forbiddenPatterns.length}`)
if (cafeFaustTest.errors.length > 0) {
  console.log('Errors detected:')
  for (const error of cafeFaustTest.errors) {
    console.log(`  - ${error}`)
  }
}
console.log('')

console.log('=== SANITY CHECKS COMPLETE ===')

// Test new analytical fallback output
console.log('\n\n=== NEW ANALYTICAL FALLBACK TEST ===\n')

const newFallbackText = "Stedet ved åen i Aarhus hvor dagen starter roligt og ender socialt — åbent fra morgenmad til natøl."

console.log('Test: New analytical fallback (rewritten buildFallbackBrandEssence)')
console.log(`Text: "${newFallbackText}"`)

const newFallbackResult = validateBrandEssenceQuality(newFallbackText, dataSources)

console.log(`Result: ${newFallbackResult.passed ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Emotional score: ${newFallbackResult.details.emotionalScore}/10`)
console.log(`Sensory grounding: ${newFallbackResult.details.sensoryGroundingCount}`)
console.log(`Forbidden patterns: ${newFallbackResult.details.forbiddenPatterns}`)

if (newFallbackResult.errors.length > 0) {
  console.log('Errors detected:')
  newFallbackResult.errors.forEach(e => console.log(`  - ${e}`))
}

if (newFallbackResult.warnings.length > 0) {
  console.log('Warnings:')
  newFallbackResult.warnings.forEach(w => console.log(`  - ${w}`))
}

console.log('\n=== COMPARISON ===')
console.log(`Old operational fallback: ❌ FAIL (0/10 emotional, 2 forbidden patterns)`)
console.log(`New analytical fallback: ${newFallbackResult.passed ? '✅ PASS' : '❌ FAIL'} (${newFallbackResult.details.emotionalScore}/10 emotional, ${newFallbackResult.details.forbiddenPatterns} forbidden patterns)`)
