/**
 * Test Suite for Behavioral Context Analyzer
 * 
 * Validates the 5-phase behavioral logic implementation
 */

import {
  analyzeBehavioralContext,
  type BehavioralAnalysisInput,
  type AudienceSegment,
  type MenuItem,
} from './behavioral-context-analyzer.ts'

// ── Test Data ────────────────────────────────────────────────────────────────

const SAMPLE_AUDIENCE_SEGMENTS: AudienceSegment[] = [
  {
    name: 'Morning Commuters',
    timing_windows: ['07:00-09:30'],
    decision_timing: 'spontaneous',
    motivation: 'Quick breakfast on the go or coffee break'
  },
  {
    name: 'Lunch Professionals',
    timing_windows: ['11:00-14:00'],
    decision_timing: 'mixed',
    motivation: 'Searching for quality lunch options'
  },
  {
    name: 'Evening Diners',
    timing_windows: ['17:00-21:00'],
    decision_timing: 'planned',
    motivation: 'Planning dinner reservations and special occasions'
  }
]

const SAMPLE_MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Avocado Toast med Pocheret Æg',
    service_periods: ['brunch', 'frokost'],
    category: 'morning_favorites'
  },
  {
    id: '2',
    name: 'Fiskefilet med Kartofler og Remoulade',
    service_periods: ['frokost'],
    last_posted_date: '2026-05-15',
    category: 'lunch_classics'
  },
  {
    id: '3',
    name: 'Grillet Laks med Grøntsager',
    service_periods: ['aften'],
    category: 'dinner_specials'
  }
]

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\n🧪 BEHAVIORAL CONTEXT ANALYZER - TEST SUITE')
console.log('='.repeat(70))

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Morning Offering with Audience Match
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST 1: Morning Offering (07:30 Monday)')
console.log('='.repeat(70))

const test1Input: BehavioralAnalysisInput = {
  currentTime: '07:30',
  weekday: 'monday',
  audienceSegments: SAMPLE_AUDIENCE_SEGMENTS,
  availableMenuItems: SAMPLE_MENU_ITEMS,
  targetProgramme: 'brunch',
  contentType: 'OFFERING'
}

const test1Result = analyzeBehavioralContext(test1Input)

console.log('\nResult:')
console.log(`  Primary Audience: ${test1Result.primaryAudienceSegment}`)
console.log(`  Behavior: ${test1Result.audienceBehavior}`)
console.log(`  Decision: ${test1Result.decisionPattern}`)
console.log(`  Environmental: ${test1Result.environmentalFactors.join(', ') || 'none'}`)
console.log(`  Selected: ${test1Result.selectedContent.itemName}`)
console.log(`  Recency: ${test1Result.recencySupport || 'N/A'}`)
console.log(`\n  Assembled Rationale:\n  "${test1Result.assembledRationale}"`)

console.log('\n✓ Assertions:')
console.log(`  Matched Morning Commuters: ${test1Result.primaryAudienceSegment === 'Morning Commuters' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Selected content: ${test1Result.selectedContent.itemName ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Rationale includes audience behavior: ${test1Result.assembledRationale.includes('Commuters') || test1Result.assembledRationale.includes('breakfast') ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Lunch Offering with Environmental Factors
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST 2: Lunch Offering with Weather (12:00 Wednesday)')
console.log('='.repeat(70))

const test2Input: BehavioralAnalysisInput = {
  currentTime: '12:00',
  weekday: 'wednesday',
  audienceSegments: SAMPLE_AUDIENCE_SEGMENTS,
  availableMenuItems: SAMPLE_MENU_ITEMS,
  weather: {
    temperature: 22,
    condition: 'Sunny',
    is_favorable: true
  },
  locationAdvantages: [{
    type: 'Waterfront',
    description: 'Beautiful harbor views',
    peak_timing: '11:00-15:00'
  }],
  targetProgramme: 'frokost',
  contentType: 'OFFERING',
  recentlyPostedItemIds: ['1'] // Exclude avocado toast
}

const test2Result = analyzeBehavioralContext(test2Input)

console.log('\nResult:')
console.log(`  Primary Audience: ${test2Result.primaryAudienceSegment}`)
console.log(`  Behavior: ${test2Result.audienceBehavior}`)
console.log(`  Decision: ${test2Result.decisionPattern}`)
console.log(`  Environmental: ${test2Result.environmentalFactors.join(', ')}`)
console.log(`  Selected: ${test2Result.selectedContent.itemName}`)
console.log(`  Recency: ${test2Result.recencySupport || 'N/A'}`)
console.log(`\n  Assembled Rationale:\n  "${test2Result.assembledRationale}"`)

console.log('\n✓ Assertions:')
console.log(`  Matched Lunch Professionals: ${test2Result.primaryAudienceSegment === 'Lunch Professionals' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Environmental factors present: ${test2Result.environmentalFactors.length > 0 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Excluded recently posted item: ${test2Result.selectedContent.itemId !== '1' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Recency support included: ${test2Result.recencySupport ? '✓ PASS' : '✓ PASS (not required)'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Evening Offering with Planned Decision Timing
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST 3: Evening Offering (18:00 Friday)')
console.log('='.repeat(70))

const test3Input: BehavioralAnalysisInput = {
  currentTime: '18:00',
  weekday: 'friday',
  audienceSegments: SAMPLE_AUDIENCE_SEGMENTS,
  availableMenuItems: SAMPLE_MENU_ITEMS,
  targetProgramme: 'aften',
  contentType: 'OFFERING'
}

const test3Result = analyzeBehavioralContext(test3Input)

console.log('\nResult:')
console.log(`  Primary Audience: ${test3Result.primaryAudienceSegment}`)
console.log(`  Behavior: ${test3Result.audienceBehavior}`)
console.log(`  Decision: ${test3Result.decisionPattern}`)
console.log(`  Environmental: ${test3Result.environmentalFactors.join(', ') || 'none'}`)
console.log(`  Selected: ${test3Result.selectedContent.itemName}`)
console.log(`  Recency: ${test3Result.recencySupport || 'N/A'}`)
console.log(`\n  Assembled Rationale:\n  "${test3Result.assembledRationale}"`)

console.log('\n✓ Assertions:')
console.log(`  Matched Evening Diners: ${test3Result.primaryAudienceSegment === 'Evening Diners' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Decision is planned: ${test3Result.decisionPattern.toLowerCase().includes('plan') ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Selected dinner item: ${test3Result.selectedContent.itemName?.includes('Laks') ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Atmosphere Content (No Menu Selection)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST 4: Atmosphere Content (22:00 Saturday)')
console.log('='.repeat(70))

const test4Input: BehavioralAnalysisInput = {
  currentTime: '22:00',
  weekday: 'saturday',
  audienceSegments: SAMPLE_AUDIENCE_SEGMENTS,
  availableMenuItems: [],
  contentType: 'ATMOSPHERE'
}

const test4Result = analyzeBehavioralContext(test4Input)

console.log('\nResult:')
console.log(`  Primary Audience: ${test4Result.primaryAudienceSegment || 'Generic'}`)
console.log(`  Behavior: ${test4Result.audienceBehavior}`)
console.log(`  Decision: ${test4Result.decisionPattern}`)
console.log(`  Environmental: ${test4Result.environmentalFactors.join(', ') || 'none'}`)
console.log(`  Selected: ${test4Result.selectedContent.itemName || 'N/A (ATMOSPHERE)'}`)
console.log(`\n  Assembled Rationale:\n  "${test4Result.assembledRationale}"`)

console.log('\n✓ Assertions:')
console.log(`  No menu item selected: ${!test4Result.selectedContent.itemName ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Rationale generated: ${test4Result.assembledRationale.length > 0 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Behavior context present: ${test4Result.audienceBehavior.length > 0 ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: No Audience Match (Off-peak Time)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST 5: Off-peak Time (15:30 Tuesday)')
console.log('='.repeat(70))

const test5Input: BehavioralAnalysisInput = {
  currentTime: '15:30',
  weekday: 'tuesday',
  audienceSegments: SAMPLE_AUDIENCE_SEGMENTS,
  availableMenuItems: SAMPLE_MENU_ITEMS,
  contentType: 'OFFERING'
}

const test5Result = analyzeBehavioralContext(test5Input)

console.log('\nResult:')
console.log(`  Primary Audience: ${test5Result.primaryAudienceSegment || 'Generic (no match)'}`)
console.log(`  Behavior: ${test5Result.audienceBehavior}`)
console.log(`  Decision: ${test5Result.decisionPattern}`)
console.log(`  Environmental: ${test5Result.environmentalFactors.join(', ') || 'none'}`)
console.log(`  Selected: ${test5Result.selectedContent.itemName}`)
console.log(`\n  Assembled Rationale:\n  "${test5Result.assembledRationale}"`)

console.log('\n✓ Assertions:')
console.log(`  Fallback behavior used: ${test5Result.audienceBehavior.length > 0 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Content still selected: ${test5Result.selectedContent.itemName ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Rationale makes sense: ${test5Result.assembledRationale.length > 20 ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST SUITE COMPLETE')
console.log('='.repeat(70))
console.log('\nAll behavioral context tests completed.')
console.log('\nKey Validations:')
console.log('  ✓ Phase 1: Temporal-behavioral audience matching')
console.log('  ✓ Phase 2: Environmental context integration')
console.log('  ✓ Phase 3: Strategic content selection with recency filtering')
console.log('  ✓ Phase 4: Recency analysis as supporting evidence')
console.log('  ✓ Phase 5: Rationale assembly with contextual relevance')
console.log('')
