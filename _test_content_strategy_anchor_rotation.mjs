#!/usr/bin/env -S deno run --allow-env
/**
 * Test Suite: Content Strategy Anchor Rotation (V5.6)
 * 
 * Tests the rotation logic in phase2b.ts that cycles through:
 * - brand_anchors (for build_brand posts)
 * - footfall_signals (for drive_footfall posts)
 * - loyalty_hooks (for retain_loyalty posts)
 * 
 * Goal: Ensure weekly posts use different anchors for variety.
 * 
 * Previous: Always used [0] → same anchor repeated
 * New: Uses postIndex % anchors.length → cycles through all
 */

// ============================================================================
// MOCK ROTATION LOGIC (extracted from phase2b.ts)
// ============================================================================

function selectContentStrategyAnchor(contentStrategy, goalMode, postIndex) {
  const cs = contentStrategy
  
  if (!cs || !goalMode) return ''
  
  if (goalMode === 'drive_footfall' && cs.footfall_signals?.length > 0) {
    const signals = cs.footfall_signals
    return signals[postIndex % signals.length]
  }
  
  if (goalMode === 'build_brand' && cs.brand_anchors?.length > 0) {
    const anchors = cs.brand_anchors
    return anchors[postIndex % anchors.length]
  }
  
  if (goalMode === 'retain_loyalty' && cs.loyalty_hooks?.length > 0) {
    const hooks = cs.loyalty_hooks
    return hooks[postIndex % hooks.length]
  }
  
  return ''
}

// ============================================================================
// TEST CASES
// ============================================================================

const tests = [
  {
    name: 'build_brand: Single anchor (legacy behavior)',
    input: {
      contentStrategy: {
        brand_anchors: ['AFTEN håndværk']
      },
      goalMode: 'build_brand',
      postSequence: [0, 1, 2, 3]
    },
    expected: [
      'AFTEN håndværk',
      'AFTEN håndværk',
      'AFTEN håndværk',
      'AFTEN håndværk'
    ]
  },
  
  {
    name: 'build_brand: 3 anchors rotate across 4 posts',
    input: {
      contentStrategy: {
        brand_anchors: [
          'Brunch-oplevelse',
          'Frokost-kvalitet',
          'Bar-håndværk'
        ]
      },
      goalMode: 'build_brand',
      postSequence: [0, 1, 2, 3]
    },
    expected: [
      'Brunch-oplevelse',  // postIndex 0
      'Frokost-kvalitet',  // postIndex 1
      'Bar-håndværk',      // postIndex 2
      'Brunch-oplevelse'   // postIndex 3 wraps around
    ]
  },
  
  {
    name: 'build_brand: 6 anchors across 4 posts',
    input: {
      contentStrategy: {
        brand_anchors: [
          'Brunch-oplevelse',
          'Frokost-kvalitet',
          'Bar-håndværk',
          'Hjemmelavet pasta',
          'Placering ved åen',
          'Vandkant-oplevelse'
        ]
      },
      goalMode: 'build_brand',
      postSequence: [0, 1, 2, 3]
    },
    expected: [
      'Brunch-oplevelse',    // postIndex 0
      'Frokost-kvalitet',    // postIndex 1
      'Bar-håndværk',        // postIndex 2
      'Hjemmelavet pasta'    // postIndex 3
    ]
  },
  
  {
    name: 'drive_footfall: Rotate through footfall signals',
    input: {
      contentStrategy: {
        footfall_signals: [
          'Brunch (spontan besøg)',
          'Frokost (spontan besøg)',
          'daglig trafik'
        ]
      },
      goalMode: 'drive_footfall',
      postSequence: [0, 1, 2, 3]
    },
    expected: [
      'Brunch (spontan besøg)',
      'Frokost (spontan besøg)',
      'daglig trafik',
      'Brunch (spontan besøg)'
    ]
  },
  
  {
    name: 'retain_loyalty: Rotate through loyalty hooks',
    input: {
      contentStrategy: {
        loyalty_hooks: [
          'Brunch',
          'Frokost',
          'fast ugentligt besøg'
        ]
      },
      goalMode: 'retain_loyalty',
      postSequence: [0, 1, 2, 3]
    },
    expected: [
      'Brunch',
      'Frokost',
      'fast ugentligt besøg',
      'Brunch'
    ]
  },
  
  {
    name: 'Mixed goal modes in same week',
    input: {
      contentStrategy: {
        brand_anchors: ['Brunch-oplevelse', 'Bar-håndværk'],
        footfall_signals: ['daglig trafik']
      },
      posts: [
        { goalMode: 'build_brand', postIndex: 0 },
        { goalMode: 'drive_footfall', postIndex: 1 },
        { goalMode: 'build_brand', postIndex: 2 },
        { goalMode: 'drive_footfall', postIndex: 3 }
      ]
    },
    expected: [
      'Brunch-oplevelse',  // build_brand, postIndex 0 → brand_anchors[0]
      'daglig trafik',     // drive_footfall, postIndex 1 → footfall_signals[1 % 1]
      'Brunch-oplevelse',  // build_brand, postIndex 2 → brand_anchors[2 % 2] = anchors[0]
      'daglig trafik'      // drive_footfall, postIndex 3 → footfall_signals[3 % 1]
    ]
  },
  
  {
    name: 'Empty arrays return empty string',
    input: {
      contentStrategy: {
        brand_anchors: []
      },
      goalMode: 'build_brand',
      postSequence: [0, 1, 2, 3]
    },
    expected: ['', '', '', '']
  },
  
  {
    name: 'No content_strategy returns empty string',
    input: {
      contentStrategy: null,
      goalMode: 'build_brand',
      postSequence: [0, 1, 2, 3]
    },
    expected: ['', '', '', '']
  }
]

// ============================================================================
// TEST RUNNER
// ============================================================================

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

console.log('🧪 Testing Content Strategy Anchor Rotation (V5.6)\n')
console.log('=' .repeat(80))

let passCount = 0
let failCount = 0

tests.forEach((test, idx) => {
  let result
  
  if (test.input.posts) {
    // Mixed goal modes test
    result = test.input.posts.map(post => 
      selectContentStrategyAnchor(
        test.input.contentStrategy,
        post.goalMode,
        post.postIndex
      )
    )
  } else {
    // Single goal mode test
    result = test.input.postSequence.map(postIndex =>
      selectContentStrategyAnchor(
        test.input.contentStrategy,
        test.input.goalMode,
        postIndex
      )
    )
  }
  
  const passed = arraysEqual(result, test.expected)
  
  if (passed) {
    console.log(`✅ TEST ${idx + 1}: ${test.name}`)
    if (result.length > 0 && result[0] !== '') {
      console.log(`   Sequence: ${result.join(' → ')}`)
    }
    passCount++
  } else {
    console.log(`❌ TEST ${idx + 1}: ${test.name}`)
    console.log(`   Expected: ${test.expected.join(' → ')}`)
    console.log(`   Got:      ${result.join(' → ')}`)
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
  console.log('\n💡 Key Improvement: Posts now cycle through all content strategy anchors')
  console.log('   preventing repetitive framing within the same week.')
  Deno.exit(0)
}
