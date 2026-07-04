/**
 * Test Programme Detection - Layer 1 (Mock Data)
 * 
 * Tests deterministic programme detection with mock data to validate logic.
 * This ensures Layer 1 is 100% functional before integrating with database.
 * 
 * Test cases:
 * 1. Italian Restaurant (simple: 1 programme - dinner only)
 * 2. Café Faust (complex: 4 programmes - brunch, lunch, dinner, bar)
 * 
 * Usage:
 *   deno run --allow-net --allow-env scripts/test-programme-detection-mock.ts
 */

import { 
  detectProgrammes,
  formatProgrammesSummary,
  type ProgrammeDetectionResult 
} from '../supabase/functions/_shared/brand-profile/programme-detection.ts'

/**
 * Mock data for Italian Restaurant (Dinner-only, simple case)
 */
const ITALIAN_RESTAURANT_MOCK = {
  name: "Bella Vista Ristorante",
  openingHours: [
    { weekday: 'monday', open_time: '17:00', close_time: '22:00', closed: false, kind: 'normal' },
    { weekday: 'tuesday', open_time: '17:00', close_time: '22:00', closed: false, kind: 'normal' },
    { weekday: 'wednesday', open_time: '17:00', close_time: '22:00', closed: false, kind: 'normal' },
    { weekday: 'thursday', open_time: '17:00', close_time: '22:30', closed: false, kind: 'normal' },
    { weekday: 'friday', open_time: '17:00', close_time: '23:00', closed: false, kind: 'normal' },
    { weekday: 'saturday', open_time: '17:00', close_time: '23:00', closed: false, kind: 'normal' },
    { weekday: 'sunday', open_time: null, close_time: null, closed: true, kind: 'normal' }
  ],
  menuItems: [
    { service_periods: ['dinner', 'aften'], service_period_name: 'dinner', menu_title: 'AFTEN' },
    { service_periods: ['dinner'], service_period_name: 'dinner', menu_title: 'AFTEN' },
    { service_periods: ['dinner', 'aftensmad'], service_period_name: 'dinner', menu_title: null }
  ]
}

/**
 * Mock data for Café Faust (Multi-programme, complex case)
 */
const CAFE_FAUST_MOCK = {
  name: "Café Faust",
  openingHours: [
    { weekday: 'monday', open_time: '08:00', close_time: '23:00', closed: false, kind: 'normal' },
    { weekday: 'tuesday', open_time: '08:00', close_time: '23:00', closed: false, kind: 'normal' },
    { weekday: 'wednesday', open_time: '08:00', close_time: '23:00', closed: false, kind: 'normal' },
    { weekday: 'thursday', open_time: '08:00', close_time: '00:00', closed: false, kind: 'normal' },
    { weekday: 'friday', open_time: '08:00', close_time: '01:00', closed: false, kind: 'normal' },
    { weekday: 'saturday', open_time: '09:00', close_time: '01:00', closed: false, kind: 'normal' },
    { weekday: 'sunday', open_time: '09:00', close_time: '22:00', closed: false, kind: 'normal' }
  ],
  menuItems: [
    { service_periods: ['brunch', 'morgenmad'], service_period_name: 'brunch', menu_title: 'BRUNCH' },
    { service_periods: ['brunch'], service_period_name: 'brunch', menu_title: 'BRUNCH' },
    { service_periods: ['frokost', 'lunch'], service_period_name: 'frokost', menu_title: 'FROKOST' },
    { service_periods: ['frokost'], service_period_name: 'frokost', menu_title: 'FROKOST' },
    { service_periods: ['dinner', 'aftensmad'], service_period_name: 'dinner', menu_title: 'AFTEN' },
    { service_periods: ['dinner'], service_period_name: 'dinner', menu_title: 'AFTEN' },
    { service_periods: ['bar', 'drinks'], service_period_name: 'bar', menu_title: 'COCKTAILS' },
    { service_periods: ['bar'], service_period_name: 'bar', menu_title: 'DRINKS' }
  ]
}

/**
 * Test a business with mock data
 */
function testBusiness(name: string, mockData: any, expectedProgrammes: number) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${name}`)
  console.log('═'.repeat(60))
  
  console.log('\n📋 Input Data:')
  console.log(`   Opening Hours: ${mockData.openingHours.filter((h: any) => !h.closed).length} days`)
  console.log(`   Earliest Open: ${mockData.openingHours.find((h: any) => h.open_time)?.open_time}`)
  console.log(`   Latest Close: ${mockData.openingHours.reduce((latest: string, h: any) => {
    if (!h.close_time) return latest
    return h.close_time > latest ? h.close_time : latest
  }, '00:00')}`)
  console.log(`   Menu Items: ${mockData.menuItems.length} items`)
  
  const uniquePeriods = new Set(mockData.menuItems.flatMap((i: any) => i.service_periods || []))
  console.log(`   Service Periods: ${Array.from(uniquePeriods).join(', ')}`)
  
  console.log('\n🔍 Running Programme Detection...\n')
  
  const result = detectProgrammes(
    mockData.openingHours as any,
    mockData.menuItems as any
  )
  
  console.log(formatProgrammesSummary(result))
  
  // Validate results
  console.log('\n📊 Validation:')
  console.log(`   Expected Programmes: ${expectedProgrammes}`)
  console.log(`   Detected Programmes: ${result.totalProgrammes}`)
  
  if (result.totalProgrammes === expectedProgrammes) {
    console.log(`   ✅ PASS: Programme count matches expectation`)
  } else {
    console.log(`   ❌ FAIL: Expected ${expectedProgrammes}, got ${result.totalProgrammes}`)
  }
  
  // Check confidence levels
  const highConfidence = result.programmes.filter(p => p.confidence === 'high').length
  console.log(`   High Confidence: ${highConfidence}/${result.totalProgrammes}`)
  
  // List programme types detected
  console.log(`   Programme Types: ${result.programmes.map(p => p.type).join(', ')}`)
  
  return {
    passed: result.totalProgrammes === expectedProgrammes,
    result
  }
}

/**
 * Main test runner
 */
function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  PROGRAMME DETECTION TEST - Layer 1 (Mock Data)')
  console.log('  Validating deterministic programme detection logic')
  console.log('='.repeat(60))
  
  const results: Array<{ name: string, passed: boolean }> = []
  
  // Test 1: Simple case (Italian Restaurant - 1 programme)
  console.log('\n\n📍 TEST 1: SIMPLE CASE (Dinner-only restaurant)')
  console.log('-'.repeat(60))
  const test1 = testBusiness(
    'Italian Restaurant (Bella Vista)',
    ITALIAN_RESTAURANT_MOCK,
    1 // Expected: 1 programme (dinner)
  )
  results.push({ name: 'Italian Restaurant', passed: test1.passed })
  
  // Test 2: Complex case (Café Faust - 4 programmes)
  console.log('\n\n📍 TEST 2: COMPLEX CASE (Multi-programme café)')
  console.log('-'.repeat(60))
  const test2 = testBusiness(
    'Café Faust',
    CAFE_FAUST_MOCK,
    4 // Expected: 4 programmes (brunch, lunch, dinner, bar)
  )
  results.push({ name: 'Café Faust', passed: test2.passed })
  
  // Final summary
  console.log('\n\n' + '='.repeat(60))
  console.log('  TEST SUMMARY')
  console.log('='.repeat(60))
  
  const totalTests = results.length
  const passedTests = results.filter(r => r.passed).length
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} ${r.name}`)
  })
  
  console.log(`\n${passedTests}/${totalTests} tests passed`)
  
  if (passedTests === totalTests) {
    console.log('\n🎉 SUCCESS: Layer 1 programme detection is 100% functional!')
    console.log('   Ready to proceed to Layer 2 (Commercial Orientation)')
  } else {
    console.log('\n⚠️  FAILURE: Fix failing tests before proceeding to Layer 2')
  }
  
  console.log('\n' + '='.repeat(60) + '\n')
  
  // Exit with appropriate code
  Deno.exit(passedTests === totalTests ? 0 : 1)
}

// Run tests
main()
