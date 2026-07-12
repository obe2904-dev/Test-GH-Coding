#!/usr/bin/env node

/**
 * Manual Test: Souk Aarhus Restaurant Misclassification
 * 
 * Quick test to verify the intelligent scraping system works correctly
 * 
 * Usage: node _test_souk_aarhus.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oadwluspjlsnxhgakral.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_ANON_KEY environment variable not set')
  process.exit(1)
}

const TEST_URL = 'https://soukaarhus.dk/'
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/analyze-website`

console.log('🧪 Testing Souk Aarhus Restaurant Misclassification Prevention')
console.log('=' .repeat(70))
console.log('Test URL:', TEST_URL)
console.log('Function:', FUNCTION_URL)
console.log('')

async function testSoukAarhus() {
  console.log('📤 Sending request to analyze-website function...')
  
  const startTime = Date.now()
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        url: TEST_URL,
        businessName: 'Souk Aarhus',
        tier: 'free',
        forceRefresh: true  // Force fresh scrape to test new system
      })
    })
    
    const duration = Date.now() - startTime
    
    console.log(`📥 Response received (${duration}ms)`)
    console.log('Status:', response.status, response.statusText)
    console.log('')
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Request failed:', errorText)
      return
    }
    
    const data = await response.json()
    
    // Extract key fields
    const businessType = data.analysisResult?.businessType || data.businessType
    const businessName = data.analysisResult?.businessName || data.businessName
    const description = data.analysisResult?.description || data.description
    
    console.log('📊 RESULTS:')
    console.log('=' .repeat(70))
    console.log('Business Name:', businessName)
    console.log('Business Type:', businessType)
    console.log('Description:', description?.substring(0, 150) + '...')
    console.log('')
    
    // Check for misclassification
    const isRetail = businessType?.toLowerCase().includes('retail') ||
                     businessType?.toLowerCase().includes('shop') ||
                     businessType?.toLowerCase().includes('store')
    
    const isRestaurant = businessType?.toLowerCase().includes('restaurant') ||
                         businessType?.toLowerCase().includes('café') ||
                         businessType?.toLowerCase().includes('cafe') ||
                         businessType?.toLowerCase().includes('bar')
    
    console.log('🔍 VALIDATION:')
    console.log('=' .repeat(70))
    
    if (isRetail) {
      console.log('❌ FAILED: Souk Aarhus classified as RETAIL')
      console.log('   This is the bug we are trying to fix!')
      console.log('   Expected: Restaurant')
      console.log('   Got:', businessType)
      return false
    }
    
    if (isRestaurant) {
      console.log('✅ PASSED: Souk Aarhus correctly classified as RESTAURANT')
      console.log('   Business Type:', businessType)
      return true
    }
    
    console.log('⚠️ WARNING: Business type unclear')
    console.log('   Expected: Restaurant')
    console.log('   Got:', businessType)
    return false
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
    return false
  }
}

// Run test
testSoukAarhus()
  .then(passed => {
    console.log('')
    console.log('=' .repeat(70))
    if (passed) {
      console.log('✅ TEST PASSED: Intelligent scraping system working correctly')
      process.exit(0)
    } else {
      console.log('❌ TEST FAILED: Check implementation')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
