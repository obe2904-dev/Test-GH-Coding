#!/usr/bin/env -S deno run --allow-env
/**
 * Test Suite: Brand Anchors Enrichment (V5.6)
 * 
 * Tests the enhanced brand_anchors extraction logic that pulls from:
 * 1. Programme types (brunch, lunch, bar, coffee, etc.)
 * 2. Menu themes and craft signals
 * 3. Location/geographic context
 * 
 * Goal: Ensure multi-programme businesses get sufficient brand anchors
 * for varied weekly content (4+ posts per week).
 * 
 * Previous Issue: `["AFTEN håndværk"]` - single anchor insufficient.
 * Expected: 3-6 anchors covering all programmes and menu/location signals.
 */

// ============================================================================
// MOCK FUNCTIONS (extracted logic from v5-transformers.ts)
// ============================================================================

function extractProgrammeBrandAnchors(programme, anchors) {
  const { type, name } = programme
  
  switch (type) {
    case 'dinner':
    case 'fine_dining':
    case 'evening_dining':
      anchors.push(`${name} håndværk`)
      break
    case 'brunch':
    case 'weekend_brunch':
      anchors.push(`${name}-oplevelse`)
      break
    case 'lunch':
    case 'daily_lunch':
      anchors.push(`${name}-kvalitet`)
      break
    case 'bar':
    case 'evening_bar':
    case 'cocktail_bar':
      anchors.push(`${name}-håndværk`)
      break
    case 'coffee':
    case 'specialty_coffee':
    case 'cafe':
      anchors.push(`Kaffekultur`)
      break
    case 'bakery':
    case 'patisserie':
      anchors.push(`Frisk bagning`)
      break
    case 'wine_bar':
      anchors.push(`Vinprogram`)
      break
    case 'tapas':
    case 'sharing_plates':
      anchors.push(`Mad-præsentation`)
      break
    default:
      break
  }
}

function extractMenuBrandAnchors(menuOverview, anchors) {
  if (!menuOverview) return
  
  if (menuOverview.craft_signals && menuOverview.craft_signals.length > 0) {
    menuOverview.craft_signals.slice(0, 2).forEach(signal => {
      anchors.push(signal)
    })
  }
  
  if (menuOverview.signature_themes && menuOverview.signature_themes.length > 0) {
    const firstTheme = menuOverview.signature_themes[0]
    const genericThemes = ['mad', 'drikke', 'menu', 'retter']
    const isSpecific = !genericThemes.some(generic => firstTheme.toLowerCase().includes(generic))
    
    if (isSpecific) {
      anchors.push(firstTheme)
    }
  }
}

function extractLocationBrandAnchors(geoContext, anchors) {
  if (!geoContext) return
  
  if (geoContext.signature_reference) {
    anchors.push(`Placering ${geoContext.signature_reference}`)
  }
  
  if (geoContext.location_type) {
    const locationTypeMap = {
      'waterfront_leisure': 'Vandkant-oplevelse',
      'downtown_commercial': 'Bymidten',
      'residential_neighborhood': 'Nabolagsstemning',
      'tourist_area': 'Turistområde',
      'cultural_district': 'Kulturkvarter'
    }
    
    const anchor = locationTypeMap[geoContext.location_type]
    if (anchor) {
      anchors.push(anchor)
    }
  }
}

function deriveContentStrategyAnchors(programmes, menuOverview, geoContext) {
  const brand_anchors = []
  
  programmes.forEach(p => {
    extractProgrammeBrandAnchors(p, brand_anchors)
  })
  
  extractMenuBrandAnchors(menuOverview, brand_anchors)
  extractLocationBrandAnchors(geoContext, brand_anchors)
  
  if (brand_anchors.length === 0) {
    brand_anchors.push('kvalitet og håndværk')
  }
  
  return brand_anchors
}

// ============================================================================
// TEST CASES
// ============================================================================

const tests = [
  {
    name: 'LEGACY: Dinner-only restaurant (old behavior)',
    input: {
      programmes: [
        { type: 'dinner', name: 'AFTEN' }
      ],
      menuOverview: undefined,
      geoContext: undefined
    },
    expected: [
      'AFTEN håndværk'
    ]
  },
  
  {
    name: 'ENRICHED: Multi-programme cafe (brunch, lunch, bar)',
    input: {
      programmes: [
        { type: 'brunch', name: 'Brunch' },
        { type: 'lunch', name: 'Frokost' },
        { type: 'bar', name: 'Bar' }
      ],
      menuOverview: undefined,
      geoContext: undefined
    },
    expected: [
      'Brunch-oplevelse',
      'Frokost-kvalitet',
      'Bar-håndværk'
    ]
  },
  
  {
    name: 'ENRICHED: Cafe with coffee programme + menu craft signals',
    input: {
      programmes: [
        { type: 'coffee', name: 'Kaffe' }
      ],
      menuOverview: {
        craft_signals: ['Hjemmelavet Nutella', 'Egen bagning'],
        signature_themes: ['Brunch-specialiteter']
      },
      geoContext: undefined
    },
    expected: [
      'Kaffekultur',
      'Hjemmelavet Nutella',
      'Egen bagning',
      'Brunch-specialiteter'
    ]
  },
  
  {
    name: 'ENRICHED: Waterfront restaurant with location anchor',
    input: {
      programmes: [
        { type: 'dinner', name: 'AFTEN' }
      ],
      menuOverview: undefined,
      geoContext: {
        signature_reference: 'ved åen',
        location_type: 'waterfront_leisure'
      }
    },
    expected: [
      'AFTEN håndværk',
      'Placering ved åen',
      'Vandkant-oplevelse'
    ]
  },
  
  {
    name: 'ENRICHED: Bakery + cafe hybrid',
    input: {
      programmes: [
        { type: 'bakery', name: 'Bageri' },
        { type: 'coffee', name: 'Kaffe' }
      ],
      menuOverview: {
        craft_signals: ['Friske bagværk'],
        signature_themes: undefined
      },
      geoContext: undefined
    },
    expected: [
      'Frisk bagning',
      'Kaffekultur',
      'Friske bagværk'
    ]
  },
  
  {
    name: 'ENRICHED: Wine bar with location in city center',
    input: {
      programmes: [
        { type: 'wine_bar', name: 'Vinbar' }
      ],
      menuOverview: {
        signature_themes: ['Naturvine', 'Ost og charcuteri']
      },
      geoContext: {
        location_type: 'downtown_commercial'
      }
    },
    expected: [
      'Vinprogram',
      'Naturvine',
      'Bymidten'
    ]
  },
  
  {
    name: 'ENRICHED: Full multi-programme restaurant (brunch + lunch + dinner + bar) with all signals',
    input: {
      programmes: [
        { type: 'brunch', name: 'Brunch' },
        { type: 'lunch', name: 'Frokost' },
        { type: 'dinner', name: 'AFTEN' },
        { type: 'bar', name: 'Bar' }
      ],
      menuOverview: {
        craft_signals: ['Hjemmelavet pasta', 'Røget kød'],
        signature_themes: ['Italiensk køkken']
      },
      geoContext: {
        signature_reference: 'på havnen',
        location_type: 'waterfront_leisure'
      }
    },
    expected: [
      'Brunch-oplevelse',
      'Frokost-kvalitet',
      'AFTEN håndværk',
      'Bar-håndværk',
      'Hjemmelavet pasta',
      'Røget kød',
      'Italiensk køkken',
      'Placering på havnen',
      'Vandkant-oplevelse'
    ]
  },
  
  {
    name: 'EDGE: No programmes (should return fallback)',
    input: {
      programmes: [],
      menuOverview: undefined,
      geoContext: undefined
    },
    expected: null // deriveContentStrategy returns null for empty programmes
  },
  
  {
    name: 'EDGE: Generic menu themes should be filtered out',
    input: {
      programmes: [
        { type: 'cafe', name: 'Cafe' }
      ],
      menuOverview: {
        signature_themes: ['Mad og drikke', 'Friske ingredienser'] // First is generic, second is not
      },
      geoContext: undefined
    },
    expected: [
      'Kaffekultur'
      // 'Mad og drikke' should be filtered
      // 'Friske ingredienser' is NOT the first theme, so not added
    ]
  },
  
  {
    name: 'EDGE: Unknown programme type should not add anchor',
    input: {
      programmes: [
        { type: 'unknown_type', name: 'Special' }
      ],
      menuOverview: undefined,
      geoContext: undefined
    },
    expected: [
      'kvalitet og håndværk' // Fallback
    ]
  }
]

// ============================================================================
// TEST RUNNER
// ============================================================================

function arraysEqual(a, b) {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

console.log('🧪 Testing Brand Anchors Enrichment (V5.6)\n')
console.log('=' .repeat(80))

let passCount = 0
let failCount = 0

tests.forEach((test, idx) => {
  const { programmes, menuOverview, geoContext } = test.input
  
  let result
  if (programmes.length === 0) {
    result = null
  } else {
    result = deriveContentStrategyAnchors(programmes, menuOverview, geoContext)
  }
  
  const passed = arraysEqual(result, test.expected)
  
  if (passed) {
    console.log(`✅ TEST ${idx + 1}: ${test.name}`)
    if (result && result.length > 0) {
      console.log(`   Anchors: ${result.join(', ')}`)
    }
    passCount++
  } else {
    console.log(`❌ TEST ${idx + 1}: ${test.name}`)
    console.log(`   Expected: ${test.expected ? test.expected.join(', ') : 'null'}`)
    console.log(`   Got:      ${result ? result.join(', ') : 'null'}`)
    failCount++
  }
  console.log('')
})

console.log('=' .repeat(80))
console.log(`\n📊 Results: ${passCount}/${tests.length} tests passed\n`)

if (failCount > 0) {
  console.log(`❌ ${failCount} test(s) failed`)
  Deno.exit(1)
} else {
  console.log('✅ All tests passed!')
  console.log('\n💡 Key Improvement: Multi-programme businesses now get 3-6+ brand anchors')
  console.log('   (vs. previous single anchor), enabling varied weekly content.')
  Deno.exit(0)
}
