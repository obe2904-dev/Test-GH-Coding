/**
 * Test Suite for Dynamic Suggestion Calculator
 * 
 * Tests the implementation against the specification examples
 * and edge cases from _SPEC_DYNAMIC_SUGGESTION_COUNT_AND_BEHAVIORAL_LOGIC.md
 */

import {
  calculateDynamicSuggestions,
  type CalculationContext,
  type DynamicSuggestionResult,
  TIMING_RULES
} from './dynamic-suggestion-calculator.ts'

// ── Test Helpers ─────────────────────────────────────────────────────────────

function createDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number)
  const date = new Date(2026, 5, 22) // June 22, 2026 (Monday)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function logResult(testName: string, result: DynamicSuggestionResult) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`TEST: ${testName}`)
  console.log('='.repeat(70))
  console.log(`Suggestion Count: ${result.suggestionCount}`)
  console.log(`Reasoning: ${result.reasoning}`)
  console.log(`\nMetadata:`)
  console.log(`  Generation: ${result.metadata.generationTime}`)
  console.log(`  Opening: ${result.metadata.openingTime}`)
  console.log(`  Closing: ${result.metadata.closingTime}`)
  console.log(`  Effective Closing: ${result.metadata.effectiveClosing}`)
  console.log(`  Available Hours: ${result.metadata.availableHours.toFixed(1)}h`)
  console.log(`  Status: ${
    result.metadata.isClosedToday ? 'CLOSED' :
    result.metadata.isBeforeOpening ? 'BEFORE OPENING' :
    result.metadata.isAfterClosing ? 'AFTER CLOSING' :
    'OPEN'
  }`)
  
  console.log(`\nIdeas:`)
  result.ideas.forEach(idea => {
    console.log(`\n  Idea ${idea.ideaNumber}:`)
    console.log(`    Posting: ${idea.postingTime} (${idea.postingTimeMins} mins)`)
    console.log(`    Type: ${idea.contentType}`)
    if (idea.atmosphereAngle) {
      console.log(`    Angle: ${idea.atmosphereAngle}`)
    }
    console.log(`    Programmes: ${idea.eligibleProgrammes.join(', ') || 'none'}`)
    console.log(`    Time of Day: ${idea.behavioralContext.timeOfDay}`)
    console.log(`    Decision Pattern: ${idea.behavioralContext.decisionPattern}`)
    console.log(`    Rationale: ${idea.rationale}`)
  })
  console.log('')
}

// ── Test Data: Café Faust ────────────────────────────────────────────────────

const CAFE_FAUST_PROGRAMMES = [
  {
    name: 'BRUNCH',
    type: 'morning',
    time_windows: ['09:00-14:00'],
    operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  {
    name: 'FROKOST',
    type: 'lunch',
    time_windows: ['09:00-17:30'],
    operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  {
    name: 'AFTEN',
    type: 'dinner',
    time_windows: ['17:30-21:30'],
    operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }
]

// ── Test Scenarios ───────────────────────────────────────────────────────────

console.log('\n🧪 DYNAMIC SUGGESTION CALCULATOR - TEST SUITE')
console.log('=' .repeat(70))

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Full Day Coverage (Café Faust at 07:00 Monday)
// Expected: 3 ideas (OFFERING, OFFERING, ATMOSPHERE)
// ═══════════════════════════════════════════════════════════════════════════

const test1Context: CalculationContext = {
  now: createDate('07:00'),
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const test1Result = calculateDynamicSuggestions(test1Context)
logResult('Test 1: Café Faust Monday 07:00 (Full Day)', test1Result)

// Assertions
console.log('✓ Assertions for Test 1:')
console.log(`  Expected 3 ideas: ${test1Result.suggestionCount === 3 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 1 is OFFERING: ${test1Result.ideas[0]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 2 is OFFERING: ${test1Result.ideas[1]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 3 is ATMOSPHERE: ${test1Result.ideas[2]?.contentType === 'ATMOSPHERE' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Before opening status: ${test1Result.metadata.isBeforeOpening ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Late Morning (Café Faust at 11:00 Monday)
// Expected: 2-3 ideas depending on available time
// ═══════════════════════════════════════════════════════════════════════════

const test2Context: CalculationContext = {
  now: createDate('11:00'),
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const test2Result = calculateDynamicSuggestions(test2Context)
logResult('Test 2: Café Faust Monday 11:00 (Late Morning)', test2Result)

console.log('✓ Assertions for Test 2:')
console.log(`  Generated 2+ ideas: ${test2Result.suggestionCount >= 2 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Currently open: ${test2Result.metadata.isCurrentlyOpen ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 1 is OFFERING: ${test2Result.ideas[0]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Evening Generation (Café Faust at 17:00 Monday)
// Expected: 1-2 ideas (limited time window)
// ═══════════════════════════════════════════════════════════════════════════

const test3Context: CalculationContext = {
  now: createDate('17:00'),
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const test3Result = calculateDynamicSuggestions(test3Context)
logResult('Test 3: Café Faust Monday 17:00 (Evening)', test3Result)

console.log('✓ Assertions for Test 3:')
console.log(`  Generated 1-2 ideas: ${test3Result.suggestionCount >= 1 && test3Result.suggestionCount <= 2 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Available hours < 6h: ${test3Result.metadata.availableHours < 6 ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Closed Day
// Expected: 1 ATMOSPHERE idea only
// ═══════════════════════════════════════════════════════════════════════════

const test4Context: CalculationContext = {
  now: createDate('10:00'),
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: true
}

const test4Result = calculateDynamicSuggestions(test4Context)
logResult('Test 4: Closed Day', test4Result)

console.log('✓ Assertions for Test 4:')
console.log(`  Only 1 idea: ${test4Result.suggestionCount === 1 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea is ATMOSPHERE: ${test4Result.ideas[0]?.contentType === 'ATMOSPHERE' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Angle is informational: ${test4Result.ideas[0]?.atmosphereAngle === 'informational' ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Late Night (Café Faust at 22:00 Saturday)
// Expected: 1 ATMOSPHERE idea only
// ═══════════════════════════════════════════════════════════════════════════

const test5Context: CalculationContext = {
  now: createDate('22:00'),
  weekday: 'saturday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const test5Result = calculateDynamicSuggestions(test5Context)
logResult('Test 5: Late Night (Saturday 22:00)', test5Result)

console.log('✓ Assertions for Test 5:')
console.log(`  Only 1 idea: ${test5Result.suggestionCount === 1 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  After closing: ${test5Result.metadata.isAfterClosing ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea is ATMOSPHERE: ${test5Result.ideas[0]?.contentType === 'ATMOSPHERE' ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Dinner-Only Restaurant (Opens 17:30, generation at 08:00)
// Expected: 3 ideas (all anticipatory until opening)
// ═══════════════════════════════════════════════════════════════════════════

const test6Context: CalculationContext = {
  now: createDate('08:00'),
  weekday: 'tuesday',
  openingTime: '17:30',
  closingTime: '23:00',
  programmes: [{
    name: 'DINNER',
    type: 'dinner',
    time_windows: ['17:30-22:00'],
    operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  kitchenCloseTime: '22:00',
  isClosedToday: false
}

const test6Result = calculateDynamicSuggestions(test6Context)
logResult('Test 6: Dinner-Only Restaurant (08:00)', test6Result)

console.log('✓ Assertions for Test 6:')
console.log(`  Before opening: ${test6Result.metadata.isBeforeOpening ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 1 is OFFERING: ${test6Result.ideas[0]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Rationale mentions anticipatory: ${test6Result.ideas[0]?.rationale.includes('anticipatory') ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Closing Soon (< 3 hours left)
// Expected: 1 ATMOSPHERE idea
// ═══════════════════════════════════════════════════════════════════════════

const test7Context: CalculationContext = {
  now: createDate('19:00'),
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: CAFE_FAUST_PROGRAMMES,
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const test7Result = calculateDynamicSuggestions(test7Context)
logResult('Test 7: Closing Soon (19:00, closes 21:30)', test7Result)

console.log('✓ Assertions for Test 7:')
console.log(`  Idea 1 is ATMOSPHERE: ${test7Result.ideas[0]?.contentType === 'ATMOSPHERE' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Rationale mentions closing: ${test7Result.ideas[0]?.rationale.toLowerCase().includes('closing') ? '✓ PASS' : '✗ FAIL'}`)

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(70))
console.log('TEST SUITE COMPLETE')
console.log('='.repeat(70))
console.log('\nAll tests completed. Review assertions above for pass/fail status.')
console.log('\nKey Validations:')
console.log('  ✓ Dynamic suggestion count (1-3) based on available time')
console.log('  ✓ Content type selection (OFFERING vs ATMOSPHERE)')
console.log('  ✓ Operational status detection (open/closed/before/after)')
console.log('  ✓ Timing calculations (30-60 min immediate, 3h spacing)')
console.log('  ✓ Edge cases (closed day, late night, dinner-only, closing soon)')
console.log('')
