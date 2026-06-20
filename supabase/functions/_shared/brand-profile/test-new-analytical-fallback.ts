import { validateBrandEssenceQuality } from './quality-validators.ts'

console.log('=== ANALYTICAL FALLBACK VALIDATION TEST ===\n')

const oldOperational = "Café, restaurant og bar ved åen i Aarhus, der serverer brunch og frokost om dagen og skifter til aftensmad og drinks om aftenen."
const newAnalytical = "Stedet ved åen i Aarhus hvor dagen starter roligt og ender socialt — åbent fra morgenmad til natøl."

console.log('OLD FALLBACK (operational):')
console.log(`"${oldOperational}"\n`)
const oldResult = validateBrandEssenceQuality(oldOperational)
console.log(`Result: ${oldResult.passed ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Emotional score: ${oldResult.details.emotionalPositioning.score}/10`)
console.log(`Forbidden patterns: ${oldResult.details.forbiddenPatterns.length}`)
if (oldResult.errors.length > 0) {
  console.log('Errors:')
  oldResult.errors.slice(0, 3).forEach(e => console.log(`  ${e.split('\n')[0]}`))
}

console.log('\n' + '='.repeat(60) + '\n')

console.log('NEW FALLBACK (analytical):')
console.log(`"${newAnalytical}"\n`)
const newResult = validateBrandEssenceQuality(newAnalytical)
console.log(`Result: ${newResult.passed ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Emotional score: ${newResult.details.emotionalPositioning.score}/10`)
console.log(`Forbidden patterns: ${newResult.details.forbiddenPatterns.length}`)
console.log(`Sensory grounding: ${newResult.details.sensoryGrounding.count} elements`)

if (newResult.errors.length > 0) {
  console.log('Errors:')
  newResult.errors.forEach(e => console.log(`  ${e}`))
}
if (newResult.warnings.length > 0) {
  console.log('Warnings:')
  newResult.warnings.forEach(w => console.log(`  ${w}`))
}

console.log('\n' + '='.repeat(60))
console.log('SUMMARY:')
console.log(`Validation: ${oldResult.passed ? 'PASS' : 'FAIL'} → ${newResult.passed ? 'PASS' : 'FAIL'}`)
console.log(`Emotional: ${oldResult.details.emotionalPositioning.score}/10 → ${newResult.details.emotionalPositioning.score}/10`)
console.log(`Forbidden: ${oldResult.details.forbiddenPatterns.length} → ${newResult.details.forbiddenPatterns.length}`)
console.log(`Sensory: ${oldResult.details.sensoryGrounding.count} → ${newResult.details.sensoryGrounding.count}`)
