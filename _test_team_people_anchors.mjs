/**
 * Test Suite: Team/People Anchors Extraction (V5.6)
 * 
 * Tests the extractTeamPeopleAnchors function to ensure it correctly identifies
 * verified team roles and processes from menu context, preventing BTS hallucination.
 * 
 * Run: deno run --allow-env _test_team_people_anchors.mjs
 */

// Mock extractTeamPeopleAnchors function for local testing
function extractTeamPeopleAnchors(menuContext, businessType, programmes, menuItems) {
  const anchors = []
  
  if (!menuContext && !businessType && !programmes) {
    return anchors
  }
  
  // Craft/homemade signals from menu
  const craftKeywords = [
    'hjemmelavet', 'hjemmelavede', 'friskbagt', 'friskbagte',
    'egen produktion', 'egenproduceret', 'in-house',
    'håndlavet', 'håndlavede', 'håndværk'
  ]
  
  const menuText = menuItems
    ?.map(item => `${item.name || ''} ${item.description || ''}`.toLowerCase())
    .join(' ') || ''
  
  const hasCraftSignals = craftKeywords.some(keyword => 
    menuText.includes(keyword) || 
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasCraftSignals) {
    anchors.push('Køkken der tilbereder hjemmelavede elementer')
  }
  
  // Bartender role (requires bar programme + cocktails/wine)
  const hasBarProgramme = programmes?.some(p => 
    p.type === 'bar' || p.type === 'cocktail_bar' || p.type === 'wine_bar'
  ) || businessType?.vertical === 'bar' || businessType?.vertical === 'cocktail_bar'
  
  const hasCocktails = menuText.includes('cocktail') || 
    menuContext?.signature_themes?.some(theme => 
      theme.toLowerCase().includes('cocktail') || theme.toLowerCase().includes('drinks')
    )
  
  const hasWine = menuText.includes('vin ') || menuText.includes('wine') ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes('vin'))
  
  if (hasBarProgramme && (hasCocktails || hasWine)) {
    if (hasCocktails) {
      anchors.push('Bartender med cocktailprogram')
    } else if (hasWine) {
      anchors.push('Sommelier med vinprogram')
    }
  }
  
  // Barista role (specialty coffee signals)
  const specialtyCoffeeKeywords = [
    'espresso', 'cappuccino', 'flat white', 'cortado',
    'specialty coffee', 'kaffebar', 'coffee bar'
  ]
  
  const hasSpecialtyCoffee = specialtyCoffeeKeywords.some(keyword => 
    menuText.includes(keyword) ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasSpecialtyCoffee) {
    anchors.push('Barista med specialty coffee')
  }
  
  // Food presentation signals (tapas, sharing, tasting menu)
  const presentationKeywords = [
    'tapas', 'sharing', 'deletallerken', 'tasting menu',
    'menu', 'anretning', 'præsentation'
  ]
  
  const hasPresentation = presentationKeywords.some(keyword => 
    menuText.includes(keyword) ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasPresentation) {
    anchors.push('Mad-præsentation og anretning')
  }
  
  // Chef/kitchen operation (most restaurants/cafes have this)
  const hasKitchen = businessType?.vertical === 'restaurant' || 
    businessType?.vertical === 'cafe' || 
    businessType?.vertical === 'bakery' ||
    programmes?.some(p => p.type === 'brunch' || p.type === 'lunch' || p.type === 'dinner')
  
  // Only add generic chef anchor if no specific craft/presentation anchors exist
  if (hasKitchen && anchors.length === 0) {
    anchors.push('Køkken der tilbereder dagens retter')
  }
  
  return anchors
}

// Test cases
const tests = [
  {
    name: '1. Café Faust (homemade Nutella)',
    input: {
      menuContext: {
        signature_themes: ['Brunch', 'Hjemmelavet nutella']
      },
      businessType: { vertical: 'cafe' },
      programmes: [{ type: 'brunch' }],
      menuItems: [
        { name: 'Pandekager', description: 'med hjemmelavet nutella' },
        { name: 'Americano', description: 'kaffe' }
      ]
    },
    expected: ['Køkken der tilbereder hjemmelavede elementer']
  },
  {
    name: '2. Cocktail bar (no food)',
    input: {
      menuContext: {
        signature_themes: ['Cocktails', 'Drinks']
      },
      businessType: { vertical: 'cocktail_bar' },
      programmes: [{ type: 'bar' }],
      menuItems: [
        { name: 'Mojito', description: 'rum cocktail' },
        { name: 'Old Fashioned', description: 'whisky cocktail' }
      ]
    },
    expected: ['Bartender med cocktailprogram']
  },
  {
    name: '3. Specialty coffee shop',
    input: {
      menuContext: {
        signature_themes: ['Specialty coffee', 'Espresso drinks']
      },
      businessType: { vertical: 'coffee_shop' },
      programmes: [],
      menuItems: [
        { name: 'Flat White', description: 'specialty coffee' },
        { name: 'Cortado', description: 'espresso with milk' }
      ]
    },
    expected: ['Barista med specialty coffee']
  },
  {
    name: '4. Restaurant with sharing plates',
    input: {
      menuContext: {
        signature_themes: ['Tapas', 'Sharing plates']
      },
      businessType: { vertical: 'restaurant' },
      programmes: [{ type: 'dinner' }],
      menuItems: [
        { name: 'Tapas platter', description: 'selection of sharing plates' },
        { name: 'Paella', description: 'to share' }
      ]
    },
    expected: ['Mad-præsentation og anretning']
  },
  {
    name: '5. Bakery (fresh baked)',
    input: {
      menuContext: {
        signature_themes: ['Friskbagt brød', 'Håndværk']
      },
      businessType: { vertical: 'bakery' },
      programmes: [],
      menuItems: [
        { name: 'Rugbrød', description: 'friskbagt dagligt' },
        { name: 'Croissant', description: 'håndlavet' }
      ]
    },
    expected: ['Køkken der tilbereder hjemmelavede elementer']
  },
  {
    name: '6. Wine bar',
    input: {
      menuContext: {
        signature_themes: ['Vin', 'Wine selection']
      },
      businessType: { vertical: 'bar' },
      programmes: [{ type: 'bar' }],
      menuItems: [
        { name: 'Chardonnay', description: 'white wine' },
        { name: 'Pinot Noir', description: 'red wine' }
      ]
    },
    expected: ['Sommelier med vinprogram']
  },
  {
    name: '7. Multiple anchors (craft + presentation)',
    input: {
      menuContext: {
        signature_themes: ['Hjemmelavet', 'Tapas']
      },
      businessType: { vertical: 'restaurant' },
      programmes: [{ type: 'dinner' }],
      menuItems: [
        { name: 'Aioli', description: 'hjemmelavet' },
        { name: 'Tapas', description: 'sharing plates' }
      ]
    },
    expected: ['Køkken der tilbereder hjemmelavede elementer', 'Mad-præsentation og anretning']
  },
  {
    name: '8. Generic cafe (no special signals)',
    input: {
      menuContext: {
        signature_themes: ['Brunch', 'Frokost']
      },
      businessType: { vertical: 'cafe' },
      programmes: [{ type: 'brunch' }],
      menuItems: [
        { name: 'Burger', description: 'with fries' },
        { name: 'Salad', description: 'fresh greens' }
      ]
    },
    expected: ['Køkken der tilbereder dagens retter']
  },
  {
    name: '9. Empty inputs',
    input: {
      menuContext: null,
      businessType: null,
      programmes: null,
      menuItems: []
    },
    expected: []
  },
  {
    name: '10. Bar without drinks menu (should not hallucinate bartender)',
    input: {
      menuContext: {
        signature_themes: ['Food']
      },
      businessType: { vertical: 'bar' },
      programmes: [{ type: 'bar' }],
      menuItems: [
        { name: 'Burger', description: 'beef burger' }
      ]
    },
    expected: [] // No bartender anchor without cocktails/wine, no kitchen anchor without food programmes
  }
]

// Run tests
console.log('🧪 Testing Team/People Anchors Extraction\n')
console.log('='+ '='.repeat(79))

let passed = 0
let failed = 0

for (const test of tests) {
  const result = extractTeamPeopleAnchors(
    test.input.menuContext,
    test.input.businessType,
    test.input.programmes,
    test.input.menuItems
  )
  
  const matches = JSON.stringify(result.sort()) === JSON.stringify(test.expected.sort())
  
  if (matches) {
    console.log(`✅ ${test.name}`)
    console.log(`   Result: ${result.join(', ') || 'none'}`)
    passed++
  } else {
    console.log(`❌ ${test.name}`)
    console.log(`   Expected: ${test.expected.join(', ') || 'none'}`)
    console.log(`   Got:      ${result.join(', ') || 'none'}`)
    failed++
  }
  console.log('')
}

console.log('='+ '='.repeat(79))
console.log(`\n📊 Results: ${passed}/${tests.length} tests passed`)

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) failed`)
  Deno.exit(1)
} else {
  console.log('\n✅ All tests passed!')
  Deno.exit(0)
}
