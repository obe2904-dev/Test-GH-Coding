// Test with EXACT format from website
const candidateText = `Åbningstider
Mandag – lørdag: 11.30-22.00.
Køkkenet er åbent frem til kl. 21.`

// Simulate the parsing
const normalizedText = candidateText
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

console.log('Normalized lines:')
normalizedText.forEach((line, i) => console.log(`  ${i}: "${line}"`))

// Test detectDaysInLine on line 1
const line1 = normalizedText[1]
console.log(`\nTesting line 1: "${line1}"`)

// Detect days
const detectDays = (line) => {
  const lower = line.toLowerCase()
  const days = []
  if (/\bmandag\b/i.test(lower)) days.push('monday')
  if (/\blørdag\b/i.test(lower)) days.push('saturday')
  return days
}

const days = detectDays(line1)
console.log('Days detected:', days)

// Parse time range
const parseTimeRange = (line) => {
  const match = line.match(/(\d{1,2})(?:[:\.](\d{2}))?\s*(?:[–\-]|til|to)\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
  if (!match) {
    console.log('NO MATCH for time range')
    return null
  }
  console.log('Time range match:', match[0])
  const openMinute = match[2] || '00'
  const closeMinute = match[4] || '00'
  return {
    open: `${match[1].padStart(2, '0')}:${openMinute}`,
    close: `${match[3].padStart(2, '0')}:${closeMinute}`,
  }
}

const times = parseTimeRange(line1)
console.log('Times parsed:', times)

// Test extractServiceWindow
const lower = line1.toLowerCase()
const range = parseTimeRange(line1)
let service = null
if (/\bfrokost\b|\blunch\b/.test(lower) && range) {
  service = 'lunch'
} else if (/\baften\b|\bevening\b|\bdinner\b/.test(lower) && range) {
  service = 'evening'
} else if (range) {
  service = 'all-day'
}

console.log('\nService window:')
console.log('  service:', service)
console.log('  has service && has times:', !!(service && range))
