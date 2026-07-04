const line = "Mandag – lørdag: 11.30-22.00"

const parseTimeRange = (line) => {
  const match = line.match(/(\d{1,2})(?:[:\.](\d{2}))?\s*(?:[–\-]|til|to)\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
  if (!match) return null
  console.log('Match found:', match)
  const openMinute = match[2] || '00'
  const closeMinute = match[4] || '00'
  return {
    open: `${match[1].padStart(2, '0')}:${openMinute}`,
    close: `${match[3].padStart(2, '0')}:${closeMinute}`,
  }
}

const result = parseTimeRange(line)
console.log('Parse result:', result)

// Also test detectDaysInLine
const detectDaysInLine = (line) => {
  const lower = line.toLowerCase()
  const days = []
  
  if (/\bmandag\b/i.test(lower)) days.push('monday')
  if (/\btirsdag\b/i.test(lower)) days.push('tuesday')
  if (/\bonsdag\b/i.test(lower)) days.push('wednesday')
  if (/\btorsdag\b/i.test(lower)) days.push('thursday')
  if (/\bfredag\b/i.test(lower)) days.push('friday')
  if (/\blørdag\b/i.test(lower)) days.push('saturday')
  if (/\bsøndag\b/i.test(lower)) days.push('sunday')
  
  return days
}

const days = detectDaysInLine(line)
console.log('Days detected:', days)
