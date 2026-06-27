/**
 * Test Suite: Team/People Anchors - HYBRID BUSINESSES (V5.6)
 * 
 * Tests that extractTeamPeopleAnchors correctly handles hybrid businesses
 * with multiple verticals (cafe+bar, coffee+wine, bakery+cafe, etc.)
 * 
 * Run: deno run --allow-env _test_team_people_anchors_hybrids.mjs
 */

// Mock extractTeamPeopleAnchors function
function extractTeamPeopleAnchors(menuContext, businessType, programmes, menuItems) {
  const anchors = []
  
  if (!menuContext && !businessType && !programmes) {
    return anchors
  }
  
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
  
  const hasKitchen = businessType?.vertical === 'restaurant' || 
    businessType?.vertical === 'cafe' || 
    businessType?.vertical === 'bakery' ||
    programmes?.some(p => p.type === 'brunch' || p.type === 'lunch' || p.type === 'dinner')
  
  if (hasKitchen && anchors.length === 0) {
    anchors.push('Køkken der tilbereder dagens retter')
  }
  
  return anchors
}

// Hybrid business test cases
const hybridTests = [
  {
    name: 'HYBRID 1: Cafe + Bar (daytime food, evening cocktails)',
    input: {
      menuContext: {
        signature_themes: ['Brunch', 'Cocktails', 'Hjemmelavet']
      },
      businessType: { vertical: 'cafe' }, // Hybrid detected via programmes
      programmes: [
        { type: 'brunch' },
        { type: 'lunch' },
        { type: 'bar' }
      ],
      menuItems: [
        { name: 'Avocado toast', description: 'hjemmelavet brød' },
        { name: 'Mojito', description: 'rum cocktail' },
        { name: 'Negroni', description: 'gin cocktail' }
      ]
    },
    expected: [
      'Køkken der tilbereder hjemmelavede elementer',
      'Bartender med cocktailprogram'
    ]
  },
  {
    name: 'HYBRID 2: Coffee & Wine Bar (no food)',
    input: {
      menuContext: {
        signature_themes: ['Specialty coffee', 'Natural wine']
      },
      businessType: { vertical: 'bar' },
      programmes: [{ type: 'bar' }],
      menuItems: [
        { name: 'Flat White', description: 'specialty coffee' },
        { name: 'Cortado', description: 'espresso based' },
        { name: 'Chardonnay', description: 'white wine from Loire' },
        { name: 'Pinot Noir', description: 'red wine from Burgundy' }
      ]
    },
    expected: [
      'Sommelier med vinprogram', // Wine takes priority over cocktails in else-if
      'Barista med specialty coffee'
    ]
  },
  {
    name: 'HYBRID 3: Bakery + Cafe (fresh baked + coffee)',
    input: {
      menuContext: {
        signature_themes: ['Friskbagt', 'Kaffe', 'Håndværk']
      },
      businessType: { vertical: 'bakery' },
      programmes: [{ type: 'brunch' }],
      menuItems: [
        { name: 'Rugbrød', description: 'friskbagt dagligt' },
        { name: 'Croissant', description: 'håndlavet' },
        { name: 'Cappuccino', description: 'specialty coffee' }
      ]
    },
    expected: [
      'Køkken der tilbereder hjemmelavede elementer',
      'Barista med specialty coffee'
    ]
  },
  {
    name: 'HYBRID 4: Restaurant + Bar (dinner + cocktails + presentation)',
    input: {
      menuContext: {
        signature_themes: ['Modern Nordic', 'Cocktails', 'Tasting menu']
      },
      businessType: { vertical: 'restaurant' },
      programmes: [
        { type: 'dinner' },
        { type: 'bar' }
      ],
      menuItems: [
        { name: 'Tasting menu', description: '5 courses with wine pairing' },
        { name: 'Tapas selection', description: 'sharing plates' },
        { name: 'Old Fashioned', description: 'whisky cocktail' }
      ]
    },
    expected: [
      'Bartender med cocktailprogram',
      'Mad-præsentation og anretning'
    ]
  },
  {
    name: 'HYBRID 5: Coffee + Wine + Food (triple hybrid)',
    input: {
      menuContext: {
        signature_themes: ['Specialty coffee', 'Natural wine', 'Brunch', 'Hjemmelavet']
      },
      businessType: { vertical: 'cafe' },
      programmes: [
        { type: 'brunch' },
        { type: 'bar' }
      ],
      menuItems: [
        { name: 'Eggs Benedict', description: 'hjemmelavet hollandaise' },
        { name: 'Flat White', description: 'specialty espresso' },
        { name: 'Natural wine', description: 'organic wine selection' }
      ]
    },
    expected: [
      'Køkken der tilbereder hjemmelavede elementer',
      'Sommelier med vinprogram',
      'Barista med specialty coffee'
    ]
  },
  {
    name: 'HYBRID 6: All-day cafe (no special signals, just food programmes)',
    input: {
      menuContext: {
        signature_themes: ['Brunch', 'Lunch']
      },
      businessType: { vertical: 'cafe' },
      programmes: [
        { type: 'brunch' },
        { type: 'lunch' }
      ],
      menuItems: [
        { name: 'Burger', description: 'beef burger with fries' },
        { name: 'Salad', description: 'fresh greens' },
        { name: 'Coffee', description: 'regular coffee' }
      ]
    },
    expected: [
      'Køkken der tilbereder dagens retter' // Generic fallback when no specific signals
    ]
  }
]

// Run tests
console.log('🧪 Testing Team/People Anchors - HYBRID BUSINESSES\n')
console.log('='+ '='.repeat(79))

let passed = 0
let failed = 0

for (const test of hybridTests) {
  const result = extractTeamPeopleAnchors(
    test.input.menuContext,
    test.input.businessType,
    test.input.programmes,
    test.input.menuItems
  )
  
  const matches = JSON.stringify(result.sort()) === JSON.stringify(test.expected.sort())
  
  if (matches) {
    console.log(`✅ ${test.name}`)
    console.log(`   Anchors: ${result.join(', ')}`)
    passed++
  } else {
    console.log(`❌ ${test.name}`)
    console.log(`   Expected: ${test.expected.join(', ')}`)
    console.log(`   Got:      ${result.join(', ')}`)
    failed++
  }
  console.log('')
}

console.log('='+ '='.repeat(79))
console.log(`\n📊 Results: ${passed}/${hybridTests.length} hybrid tests passed`)

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) failed`)
  Deno.exit(1)
} else {
  console.log('\n✅ All hybrid business tests passed!')
  console.log('\n💡 Key Insight: The function accumulates multiple anchors,')
  console.log('   making it perfect for hybrid businesses with multiple verticals.')
  Deno.exit(0)
}
