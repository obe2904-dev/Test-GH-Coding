// Test full extraction logic
const html = `
<h2>Åbningstider</h2>
<p>Mandag – lørdag: 11.30-22.00.</p>
<p>Køkkenet er åbent frem til kl. 21.</p>
`

// Simulate htmlToCleanText
let text = html
  .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## H2: $1 ##\n')
  .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
  .replace(/<[^>]+>/g, ' ')

const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

// Helper functions
function normalizeHeadingText(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isHeadingMarker(line) {
  return /^#{1,3}\s*h\d:/i.test(line)
}

function stripHeadingMarker(line) {
  return line
    .replace(/^#{1,3}\s*h\d:\s*/i, '')
    .replace(/\s*#{1,3}\s*$/i, '')
    .trim()
}

// Test extraction
const headings = ['åbningstider', 'opening hours', 'åbent', 'kontakt']
const normalizedHeadings = headings.map(h => normalizeHeadingText(h))
console.log('Normalized headings:', normalizedHeadings)

const candidates = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  console.log(`\nLine ${i}: "${line}"`)
  
  if (!isHeadingMarker(line)) {
    console.log('  → Not a heading marker')
    continue
  }
  console.log('  → IS a heading marker!')

  const headingText = stripHeadingMarker(line)
  console.log('  → Stripped:', headingText)
  
  const normalizedHeading = normalizeHeadingText(headingText)
  console.log('  → Normalized:', normalizedHeading)
  
  const matchesHeading = normalizedHeadings.some((needle) => normalizedHeading.includes(needle))
  console.log('  → Matches heading?', matchesHeading)
  
  if (!matchesHeading) continue

  const block = [headingText]
  let added = 0

  for (let j = i + 1; j < lines.length && added < 8; j++) {
    const next = lines[j]
    if (isHeadingMarker(next)) break
    block.push(next)
    added++
  }

  const candidate = block.join('\n').trim()
  console.log('  → Candidate block:', JSON.stringify(candidate))
  
  if (candidate && !candidates.includes(candidate)) {
    candidates.push(candidate)
  }
}

console.log('\n\n=== FINAL CANDIDATES ===')
candidates.forEach((c, i) => {
  console.log(`\nCandidate ${i}:`)
  console.log(c)
})
