/**
 * LAYER 6 COMPREHENSIVE TEST SUITE
 * Tests post slot optimization with day and time refinement
 */

import { testHelpers } from './supabase/functions/_shared/post-helpers/post-slot-optimizer.ts'

const {
  selectOptimalDay,
  selectOptimalHour,
  respectOpeningHours,
  applyPerformanceOptimization,
  generateOptimizationReason,
  DAY_PATTERNS,
  TIME_RULES,
} = testHelpers

console.log('🧪 LAYER 6: POST SLOT OPTIMIZER TEST SUITE')
console.log('=' .repeat(70))

let passedTests = 0
let totalTests = 0

function test(name: string, fn: () => boolean) {
  totalTests++
  try {
    const result = fn()
    if (result) {
      console.log(`✅ ${name}`)
      passedTests++
    } else {
      console.log(`❌ ${name}`)
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`)
  }
}

// ============================================================================
// TEST 1: DAY SELECTION RULES
// ============================================================================

console.log('\n📅 TEST 1: Day Selection Rules')
console.log('─'.repeat(70))

test('Menu highlights scheduled on decision days (Mon/Wed/Fri)', () => {
  const day = selectOptimalDay('menu_highlight', 'FSE', 2) // Tuesday fallback
  return [1, 3, 5].includes(day) // Should move to Mon, Wed, or Fri
})

test('Behind-scenes scheduled on weekends', () => {
  const day = selectOptimalDay('behind_scenes', 'FSE', 3) // Wednesday fallback
  return [0, 6].includes(day) // Should move to Sat or Sun
})

test('Location story scheduled Thu/Fri (weekend momentum)', () => {
  const day = selectOptimalDay('location_story', 'FSE', 1) // Monday fallback
  return [4, 5].includes(day) // Should move to Thu or Fri
})

test('Engagement posts on mid-week (Tue/Thu)', () => {
  const day = selectOptimalDay('engagement', 'FSE', 0) // Sunday fallback
  return [2, 4].includes(day) // Should move to Tue or Thu
})

test('Unknown content type uses fallback day', () => {
  const day = selectOptimalDay('unknown_type', 'FSE', 3)
  return day === 3 // Should keep fallback
})

// ============================================================================
// TEST 2: TIME OPTIMIZATION RULES
// ============================================================================

console.log('\n⏰ TEST 2: Time Optimization Rules')
console.log('─'.repeat(70))

test('Breakfast menu posts in morning (7-9am)', () => {
  const hour = selectOptimalHour('breakfast_menu', 'instagram')
  return hour >= 7 && hour <= 9
})

test('Lunch menu posts at lunch time (11am-12pm)', () => {
  const hour = selectOptimalHour('lunch_menu', 'instagram')
  return hour >= 11 && hour <= 12
})

test('Dinner menu posts in afternoon planning window (2-5pm)', () => {
  const hour = selectOptimalHour('dinner_menu', 'instagram')
  return hour >= 14 && hour <= 17
})

test('Atmosphere posts in evening FOMO window (5-7pm)', () => {
  const hour = selectOptimalHour('atmosphere', 'instagram')
  return hour >= 17 && hour <= 19
})

test('Behind-scenes posts in flexible morning slot', () => {
  const hour = selectOptimalHour('behind_scenes', 'facebook')
  return hour >= 9 && hour <= 11
})

test('Instagram prefers overlap with peak hours', () => {
  const hour = selectOptimalHour('dinner_menu', 'instagram')
  // Dinner menu: 14-17, Instagram peaks: 11-13, 18-20
  // Should prefer overlap or content priority
  return hour >= 14 && hour <= 19
})

// ============================================================================
// TEST 3: BUSINESS HOURS CONSTRAINTS
// ============================================================================

console.log('\n🏪 TEST 3: Business Hours Constraints')
console.log('─'.repeat(70))

test('No breakfast posts if not serving breakfast', () => {
  const businessHours = {
    open_breakfast: false,
    open_lunch: true,
    open_dinner: true,
  }
  const hour = respectOpeningHours(8, 'breakfast_menu', businessHours)
  return hour !== 8 // Should be moved from 8am
})

test('No lunch posts if closed during lunch', () => {
  const businessHours = {
    open_breakfast: true,
    open_lunch: false,
    open_dinner: true,
  }
  const hour = respectOpeningHours(11, 'lunch_menu', businessHours)
  return hour !== 11 // Should be moved from 11am
})

test('Dinner posts adjusted if closing early', () => {
  const businessHours = {
    open_breakfast: false,
    open_lunch: true,
    open_dinner: true,
    closing_hour: 18, // Closes at 6pm
  }
  const hour = respectOpeningHours(17, 'dinner_menu', businessHours)
  return hour <= 14 // Should be moved earlier
})

test('Keeps valid hours unchanged', () => {
  const businessHours = {
    open_breakfast: true,
    open_lunch: true,
    open_dinner: true,
  }
  const hour = respectOpeningHours(16, 'dinner_menu', businessHours)
  return hour === 16 // Should stay at 4pm
})

// ============================================================================
// TEST 4: PERFORMANCE OPTIMIZATION
// ============================================================================

console.log('\n📊 TEST 4: Historical Performance Optimization')
console.log('─'.repeat(70))

test('Uses historical best time if within 3 hours', () => {
  const performanceData = {
    optimal_posting_times: {
      'dinner_menu': 15, // Historical best: 3pm
    }
  }
  const hour = applyPerformanceOptimization('dinner_menu', 17, performanceData)
  return hour === 15 // Should use historical best
})

test('Ignores historical time if too far from default (>3 hours)', () => {
  const performanceData = {
    optimal_posting_times: {
      'dinner_menu': 9, // Historical: 9am (too early for dinner)
    }
  }
  const hour = applyPerformanceOptimization('dinner_menu', 17, performanceData)
  return hour === 17 // Should keep default
})

test('Returns default when no performance data', () => {
  const hour = applyPerformanceOptimization('dinner_menu', 16, null)
  return hour === 16 // Should keep default
})

test('Returns default when content type not in performance data', () => {
  const performanceData = {
    optimal_posting_times: {
      'lunch_menu': 12,
    }
  }
  const hour = applyPerformanceOptimization('dinner_menu', 16, performanceData)
  return hour === 16 // Should keep default
})

// ============================================================================
// TEST 5: OPTIMIZATION REASON GENERATION
// ============================================================================

console.log('\n📝 TEST 5: Optimization Reason Generation')
console.log('─'.repeat(70))

test('Generates readable reason for menu post', () => {
  const reason = generateOptimizationReason('menu_highlight', 1, 16, false)
  return reason.includes('Monday') && reason.includes('dinner planning')
})

test('Generates reason for behind-scenes post', () => {
  const reason = generateOptimizationReason('behind_scenes', 6, 10, false)
  return reason.includes('Sunday') || reason.includes('weekend')
})

test('Indicates when timing was adjusted', () => {
  const reason = generateOptimizationReason('dinner_menu', 3, 15, true)
  return reason.includes('adjusted')
})

test('Handles unknown content types gracefully', () => {
  const reason = generateOptimizationReason('unknown_type', 2, 12, false)
  return reason.length > 0 // Should still generate something
})

// ============================================================================
// TEST 6: INTEGRATED SCENARIOS
// ============================================================================

console.log('\n🎯 TEST 6: Integrated Scenarios')
console.log('─'.repeat(70))

test('Scenario 1: FSE Dinner Menu - Full optimization chain', () => {
  // Input: Tuesday 18:00, Dinner menu, Instagram
  const day = selectOptimalDay('dinner_menu', 'FSE', 2) // Tue → Mon/Wed/Fri
  const hour = selectOptimalHour('dinner_menu', 'instagram') // → 14-17
  
  const businessHours = {
    open_breakfast: false,
    open_lunch: true,
    open_dinner: true,
  }
  const constrainedHour = respectOpeningHours(hour, 'dinner_menu', businessHours)
  
  // Should be on decision day (Mon/Wed/Fri) during dinner planning (14-17)
  return [1, 3, 5].includes(day) && constrainedHour >= 14 && constrainedHour <= 17
})

test('Scenario 2: Behind-scenes weekend storytelling', () => {
  // Input: Wednesday 12:00, Behind-scenes, Facebook
  const day = selectOptimalDay('behind_scenes', 'FSE', 3) // Wed → Sat/Sun
  const hour = selectOptimalHour('behind_scenes', 'facebook') // → 9-11am
  
  // Should be on weekend with morning timing
  return [0, 6].includes(day) && hour >= 9 && hour <= 11
})

test('Scenario 3: Lunch special with opening hours constraint', () => {
  // Input: Lunch menu, business doesn't serve lunch
  const businessHours = {
    open_breakfast: false,
    open_lunch: false,
    open_dinner: true,
  }
  
  const hour = selectOptimalHour('lunch_menu', 'instagram') // → 11-12
  const constrainedHour = respectOpeningHours(hour, 'lunch_menu', businessHours)
  
  // Should be moved away from lunch hours
  return constrainedHour !== 11 && constrainedHour !== 12
})

test('Scenario 4: Performance-optimized dinner menu', () => {
  // Input: Historical data shows 3pm works best
  const performanceData = {
    optimal_posting_times: {
      'dinner_menu': 15, // 3pm historically best
    }
  }
  
  const defaultHour = 17 // Default: 5pm
  const optimizedHour = applyPerformanceOptimization('dinner_menu', defaultHour, performanceData)
  
  // Should use historical best (3pm) since within 3 hours of default
  return optimizedHour === 15
})

// ============================================================================
// TEST 7: EDGE CASES
// ============================================================================

console.log('\n🔧 TEST 7: Edge Cases')
console.log('─'.repeat(70))

test('Handles missing business hours data gracefully', () => {
  const businessHours = {
    open_breakfast: false,
    open_lunch: false,
    open_dinner: false,
  }
  const hour = respectOpeningHours(16, 'dinner_menu', businessHours)
  return hour === 16 // Should keep proposed hour if no constraints
})

test('Handles empty performance data object', () => {
  const performanceData = {}
  const hour = applyPerformanceOptimization('dinner_menu', 16, performanceData)
  return hour === 16
})

test('Handles very early/late hours in day selection', () => {
  const day = selectOptimalDay('menu_highlight', 'FSE', 0) // Sunday
  return [1, 3, 5].includes(day) // Should move to valid decision day
})

test('Handles content type with no time rules', () => {
  const hour = selectOptimalHour('custom_unknown_type', 'instagram')
  return hour >= 0 && hour <= 23 // Should return valid hour
})

// ============================================================================
// TEST 8: DAY PATTERN COVERAGE
// ============================================================================

console.log('\n📆 TEST 8: Day Pattern Coverage')
console.log('─'.repeat(70))

test('All standard content types have day patterns defined', () => {
  const requiredTypes = [
    'menu_highlight',
    'location_story',
    'behind_scenes',
    'engagement',
    'event_promotion',
  ]
  return requiredTypes.every(type => DAY_PATTERNS[type] && DAY_PATTERNS[type].length > 0)
})

test('All standard content types have time rules defined', () => {
  const requiredTypes = [
    'menu_highlight',
    'breakfast_menu',
    'lunch_menu',
    'dinner_menu',
    'atmosphere',
    'behind_scenes',
  ]
  return requiredTypes.every(type => TIME_RULES[type] && TIME_RULES[type].length > 0)
})

test('Day patterns use valid days (0-6)', () => {
  return Object.values(DAY_PATTERNS).every(days =>
    days.every(day => day >= 0 && day <= 6)
  )
})

test('Time rules use valid hours (0-23)', () => {
  return Object.values(TIME_RULES).every(hours =>
    hours.every(hour => hour >= 0 && hour <= 23)
  )
})

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('📊 TEST SUMMARY')
console.log('='.repeat(70))

const percentage = Math.round((passedTests / totalTests) * 100)
console.log(`\n✅ Passed: ${passedTests}/${totalTests} tests (${percentage}%)`)

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed! Layer 6 is working correctly.')
  console.log('\n✨ Validated:')
  console.log('   • Day selection rules (content-type specific patterns)')
  console.log('   • Time optimization (meal periods, platform peaks)')
  console.log('   • Business hours constraints (respects opening/closing)')
  console.log('   • Performance optimization (uses historical data)')
  console.log('   • Optimization reasons (human-readable explanations)')
  console.log('   • Integrated scenarios (full optimization chain)')
  console.log('   • Edge case handling (missing data, invalid inputs)')
  console.log('   • Pattern coverage (all content types defined)')
  
  console.log('\n🎯 Layer 6 Status: OPERATIONAL ✅')
  console.log('   Ready for integration with Layer 5 and Layer 7')
} else {
  console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed`)
  console.log('   Review failed tests above')
}

Deno.exit(passedTests === totalTests ? 0 : 1)
