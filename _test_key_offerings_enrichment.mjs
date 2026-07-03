// Test script to verify key_offerings enrichment is working
// Run: node _test_key_offerings_enrichment.mjs

// Mock data simulating what website analysis extracts
const mockMenuSignal = {
  signatureItems: ['Pariserbøf', 'Faustburger', 'Moules Frites'],
  programmes: [],
  menuCategories: ['Brunch', 'Frokost', 'Aftenmenu', 'Cocktails', 'Dessert'],
  menuDescription: 'Vi serverer klassisk dansk og fransk inspireret mad. Vores Pariserbøf serveres med bløde løg, kapers og ristede kartofler. Faustburger er lavet med oksekød, cheddar, bacon og hjemmelavede pommes frites.',
  rawExtract: ''
}

const mockMenuExtraction = {
  items: [
    { name: 'Pariserbøf', description: 'Serveres med bløde løg, kapers, røræg og ristede kartofler' },
    { name: 'Faustburger', description: 'Oksekød, cheddar, bacon, salat, tomat, agurk. Serveres med pommes frites' },
    { name: 'Moules Frites', description: 'Dampede blåmuslinger i hvidvin og fløde med pommes frites' }
  ]
}

// Simulate the enrichment logic
function compactText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

const MAX_KEY_OFFERINGS = 5

function dedupeOfferings(items) {
  const seen = new Set()
  const result = []
  
  for (const item of items) {
    const cleaned = compactText(item)
    if (!cleaned || /^ingen$/i.test(cleaned)) continue
    
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    
    seen.add(key)
    result.push(cleaned)
  }
  
  return result
}

function buildEnrichedKeyOfferings(menuExtraction, menuSignal) {
  const signatureItems = Array.isArray(menuSignal?.signatureItems)
    ? menuSignal.signatureItems.map(item => compactText(item))
    : []
  
  const programmeItems = Array.isArray(menuSignal?.programmes)
    ? menuSignal.programmes.flatMap(programme => Array.isArray(programme?.items) ? programme.items : [])
    : []
  
  const fallbackItems = Array.isArray(menuSignal?.menuCategories)
    ? menuSignal.menuCategories
        .map(category => compactText(category))
        .filter(category => /cocktail|brunch|frokost|aften|dessert|smørrebrød|burger|sandwich|pasta|salat|nachos|børn|omakase|menu|retter/i.test(category))
        .slice(0, MAX_KEY_OFFERINGS)
    : []
  
  const candidates = dedupeOfferings([
    ...signatureItems,
    ...programmeItems,
    ...fallbackItems,
  ]).slice(0, MAX_KEY_OFFERINGS)
  
  if (candidates.length === 0) return null
  
  console.log(`\n📋 Extracted ${candidates.length} candidates:`)
  candidates.forEach((item, i) => console.log(`   ${i+1}. ${item}`))
  
  // Simulate AI enrichment (would normally call OpenAI here)
  const aiDetails = {
    'pariserbøf': 'bløde løg, kapers, røræg',
    'faustburger': 'oksekød, cheddar, bacon',
    'moules frites': 'blåmuslinger i hvidvin og fløde'
  }
  
  const enriched = candidates.map(item => {
    const detail = aiDetails[item.toLowerCase()] || 'klassisk dansk ret'
    return detail ? `${item} - ${detail}` : item
  })
  
  return enriched.join('\n')
}

// Run test
console.log('🧪 Testing Key Offerings Enrichment\n')
console.log('=' . repeat(50))

const result = buildEnrichedKeyOfferings(mockMenuExtraction, mockMenuSignal)

console.log('\n✅ Final enriched key_offerings:\n')
console.log(result)
console.log('\n' + '='.repeat(50))

console.log('\n📊 Expected format:')
console.log('   - Each line: "Item - detail"')
console.log('   - 5 items maximum')
console.log('   - Details from AI or fallback patterns')

console.log('\n🎯 This should be saved to business_profile.key_offerings')
console.log('   and displayed in UI under "Hvad tilbyder I?"')
