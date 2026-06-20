import { validateBrandEssenceQuality } from './quality-validators.ts'

console.log('=== FINAL ANALYTICAL FALLBACK VALIDATION ===\n')

const old = "Café, restaurant og bar ved åen i Aarhus, der serverer brunch og frokost om dagen og skifter til aftensmad og drinks om aftenen."
const final = "Det velfortjente stop ved åen i Aarhus — åbent fra morgenkaffe til natøl."

console.log('OLD (operational):')
console.log(`"${old}"\n`)
const oldResult = validateBrandEssenceQuality(old)
console.log(`${oldResult.passed ? '✅ PASS' : '❌ FAIL'} | Emotional: ${oldResult.details.emotionalPositioning.score}/10 | Forbidden: ${oldResult.details.forbiddenPatterns.length}\n`)

console.log('=' + '='.repeat(70))
console.log('\nFINAL (analytical with emotional positioning):')
console.log(`"${final}"\n`)
const finalResult = validateBrandEssenceQuality(final)
console.log(`Result: ${finalResult.passed ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Emotional score: ${finalResult.details.emotionalPositioning.score}/10`)
console.log(`Forbidden patterns: ${finalResult.details.forbiddenPatterns.length}`)
console.log(`Sensory grounding: ${finalResult.details.sensoryGrounding.count}`)

if (finalResult.errors.length > 0) {
  console.log('\nErrors:')
  finalResult.errors.forEach(e => console.log(`  - ${e}`))
}

if (finalResult.warnings.length > 0) {
  console.log('\nWarnings:')
  finalResult.warnings.forEach(w => console.log(`  - ${w}`))
}

console.log('\n' + '='.repeat(72))
console.log('TRANSFORMATION COMPLETE:')
console.log(`  Validation: FAIL → ${finalResult.passed ? 'PASS ✅' : 'FAIL'}`)
console.log(`  Emotional: 0/10 → ${finalResult.details.emotionalPositioning.score}/10`)
console.log(`  Forbidden: 5 → ${finalResult.details.forbiddenPatterns.length}`)
console.log(`  Pattern: Operational enumeration → Analytical interpretation`)
