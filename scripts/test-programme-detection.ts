/**
 * Test Programme Detection - Layer 1
 * 
 * Tests deterministic programme detection against real database data.
 * 
 * Test cases:
 * 1. Italian Restaurant (simple: 1 programme)
 * 2. Café Faust (complex: 4 programmes)
 * 
 * Usage:
 *   deno run --allow-net --allow-env test-programme-detection.ts
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.0'
import { 
  detectProgrammes,
  formatProgrammesSummary,
  type ProgrammeDetectionResult 
} from '../supabase/functions/_shared/brand-profile/programme-detection.ts'

// Supabase connection
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
                    Deno.env.get('VITE_SUPABASE_URL') || 
                    'https://kvqdkohdpvmdylqgujpn.supabase.co'

// Try multiple env var names (for flexibility)
let supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                  Deno.env.get('SUPABASE_ANON_KEY') ||
                  Deno.env.get('VITE_SUPABASE_ANON_KEY')

if (!supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('   Set one of: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Fetch business data for programme detection
 */
async function fetchBusinessData(businessIdOrName: string) {
  let businessId: string
  
  // Check if input is a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (uuidPattern.test(businessIdOrName)) {
    console.log(`\n📊 Fetching data for business ID: ${businessIdOrName}`)
    businessId = businessIdOrName
  } else {
    console.log(`\n📊 Searching for business: ${businessIdOrName}`)
    
    // Search by name
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name')
      .ilike('name', `%${businessIdOrName}%`)
      .single()
    
    if (bizError || !business) {
      console.error(`❌ Business not found: ${businessIdOrName}`)
      console.error(`   Error:`, bizError?.message)
      return null
    }
    
    businessId = business.id
    console.log(`   Found: ${business.name}`)
  }
  
  // Get business info
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .single()
  
  if (bizError || !business) {
    console.error(`❌ Error fetching business:`, bizError)
    return null
  }
  
  console.log(`   Business: ${business.name}`)
  
  // Get opening hours
  const { data: hours, error: hoursError } = await supabase
    .from('opening_hours')
    .select('weekday, open_time, close_time, closed, kind')
    .eq('business_id', business.id)
    .order('weekday')
  
  if (hoursError) {
    console.error(`❌ Error fetching opening hours:`, hoursError)
    return null
  }
  
  console.log(`   Opening hours: ${hours?.length || 0} rows`)
  
  // Get menu items
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items_normalized')
    .select('service_periods, service_period_name, menu_title')
    .eq('business_id', business.id)
  
  if (menuError) {
    console.error(`❌ Error fetching menu items:`, menuError)
    return null
  }
  
  console.log(`   Menu items: ${menuItems?.length || 0} rows`)
  
  return {
    business,
    openingHours: hours || [],
    menuItems: menuItems || []
  }
}

/**
 * Test programme detection for a business
 */
async function testBusiness(businessIdOrName: string, label: string) {
  console.log(`\n${label}`)
  const data = await fetchBusinessData(businessIdOrName)
  if (!data) return null
  
  console.log('\n🔍 Running programme detection...\n')
  
  const result = detectProgrammes(
    data.openingHours as any,
    data.menuItems as any
  )
  
  console.log('═'.repeat(60))
  console.log(formatProgrammesSummary(result))
  console.log('═'.repeat(60))
  
  // Show raw data for debugging
  console.log('\n📋 Raw Data Summary:')
  console.log(`   Service Periods: ${result.rawData.menuServicePeriods.join(', ') || 'none'}`)
  console.log(`   Menu Titles: ${result.rawData.menuTitles.join(', ') || 'none'}`)
  console.log(`   Detection Method: ${result.detectionMethod}`)
  
  return result
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  PROGRAMME DETECTION TEST - Layer 1')
  console.log('='.repeat(60))
  
  // Known business IDs from database
  const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  
  // Test 1: First find a simple dinner-only restaurant
  console.log('\n\n📍 TEST 1: FINDING SIMPLE CASE (dinner-only restaurant)')
  console.log('-'.repeat(60))
  
  // Query for a restaurant that opens after 15:00 (likely dinner-only)
  const { data: simpleBusinesses, error } = await supabase
    .from('opening_hours')
    .select(`
      business_id,
      businesses!inner(name)
    `)
    .gte('open_time', '15:00')
    .limit(5)
  
  let simpleTestResult = null
  if (simpleBusinesses && simpleBusinesses.length > 0) {
    // Use first match
    const simple = simpleBusinesses[0]
    const businessId = simple.business_id
    const businessInfo = (simple as any).businesses
    
    console.log(`\n🎯 Testing: ${businessInfo.name}`)
    simpleTestResult = await testBusiness(
      businessId,
      `📍 SIMPLE CASE TEST: ${businessInfo.name}`
    )
    
    if (simpleTestResult && simpleTestResult.totalProgrammes <= 2) {
      console.log('\n✅ PASS: Detected ≤ 2 programmes (simple case)')
    } else if (simpleTestResult) {
      console.log(`\n⚠️  INFO: Detected ${simpleTestResult.totalProgrammes} programmes`)
    }
  } else {
    console.log('\n⚠️  No dinner-only restaurants found, skipping simple case test')
  }
  
  // Test 2: Complex case (Café Faust) - known to have 4 programmes
  console.log('\n\n📍 TEST 2: COMPLEX CASE (Café Faust - 4 expected programmes)')
  console.log('-'.repeat(60))
  const result2 = await testBusiness(
    CAFE_FAUST_ID,
    '📍 COMPLEX CASE: Café Faust'
  )
  
  if (result2) {
    if (result2.totalProgrammes === 4) {
      console.log('\n✅ PASS: Detected 4 programmes (expected for Café Faust)')
      console.log('   Expected: brunch, frokost, dinner, bar')
    } else {
      console.log(`\n⚠️  WARNING: Detected ${result2.totalProgrammes} programmes (expected 4)`)
      console.log(`   Programmes found: ${result2.programmes.map(p => p.type).join(', ')}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('  TEST COMPLETE')
  console.log('='.repeat(60) + '\n')
}

// Run tests
main().catch(console.error)
