/**
 * Test escapeRegex to find what's breaking
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Test patterns from the Danish dictionary
const testPatterns = [
  'gronne zbler',
  'smgr',
  'crotitons',
  'hvidlgg',
  'creme brulee',
  'a la',
  'rode ber',
  'dildmayo',
]

console.log('🧪 Testing escapeRegex with patterns...\n')

for (const pattern of testPatterns) {
  const escaped = escapeRegex(pattern)
  console.log(`Pattern: "${pattern}"`)
  console.log(`Escaped: "${escaped}"`)
  
  try {
    // Try to use it in a regex
    const regex1 = new RegExp(`(^|\\s)${escaped}($|\\s)`, 'gi')
    const regex2 = new RegExp(`(^|\\s)${escaped}([,.:;!?\\-])`, 'gi')
    const regex3 = new RegExp(escaped, 'gi')
    console.log(`✅ All regex patterns compile successfully`)
  } catch (e) {
    console.log(`❌ Regex error: ${e}`)
  }
  console.log('')
}

// Test actual replacements
console.log('\n🔄 Testing actual replacements...\n')

const testText = 'gronne zbler og smgr med crotitons'
const corrections: Record<string, string> = {
  'gronne zbler': 'grønne æbler',
  'smgr': 'smør',
  'crotitons': 'crôutons',
}

let result = testText
for (const [error, correction] of Object.entries(corrections)) {
  const escapedError = escapeRegex(error)
  const patterns = [
    new RegExp(`(^|\\s)${escapedError}($|\\s)`, 'gi'),
    new RegExp(`(^|\\s)${escapedError}([,.:;!?\\-])`, 'gi'),
    new RegExp(escapedError, 'gi'),
  ]
  
  console.log(`Replacing "${error}" with "${correction}"`)
  console.log(`Before: "${result}"`)
  
  for (const regex of patterns) {
    const before = result
    result = result.replace(regex, (match, prefix, suffix) => {
      if (prefix === undefined) {
        return correction
      }
      return prefix + correction + suffix
    })
    if (result !== before) {
      console.log(`✅ Pattern matched and replaced: "${result}"`)
      break
    }
  }
  console.log('')
}

console.log(`Final result: "${result}"`)
