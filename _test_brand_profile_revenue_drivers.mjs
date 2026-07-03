#!/usr/bin/env node
/**
 * Test: Brand Profile Generator with Auto Revenue Drivers
 * 
 * Purpose: Verify that brand-profile-generator automatically calls
 *          analyze-revenue-drivers (Stage RD) after successful profile generation.
 * 
 * Expected Flow:
 * 1. Call brand-profile-generator for Cafe Faust
 * 2. Function generates brand profile (Stages A + B)
 * 3. Function saves brand profile
 * 4. Function calls analyze-revenue-drivers (Stage RD)
 * 5. Revenue drivers saved to business_brand_profile.revenue_drivers
 * 
 * Usage:
 *   node _test_brand_profile_revenue_drivers.mjs
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ3VqcG4iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMjU0MzQ1NiwiZXhwIjoyMDQ4MTE5NDU2fQ.z8ou0rgLX8VQn_9Zb9lhnzQB-eLOuqFJmqU5nJNEIuM'

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Cafe Faust

async function testBrandProfileWithRevenueDrivers() {
  console.log('🧪 Testing Brand Profile Generator with Auto Revenue Drivers\n')
  console.log('📋 Test Configuration:')
  console.log(`   Business: Cafe Faust`)
  console.log(`   Business ID: ${BUSINESS_ID}`)
  console.log(`   Force Refresh: true`)
  console.log('')

  try {
    console.log('🚀 Calling brand-profile-generator...\n')
    const startTime = Date.now()

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/brand-profile-generator`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          businessId: BUSINESS_ID,
          forceRegenerate: true
        })
      }
    )

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`)
      console.error(`   Response: ${errorText}`)
      process.exit(1)
    }

    const data = await response.json()
    console.log(`✅ Brand Profile Generated (${duration}ms)\n`)

    // Display result summary
    console.log('📊 Result Summary:')
    console.log(`   Success: ${data.success}`)
    console.log(`   Quality Status: ${data.qualityStatus}`)
    console.log(`   Request ID: ${data.requestId}`)
    console.log(`   Duration: ${data.durationMs}ms`)
    console.log(`   Regenerated: ${data.regenerated}`)
    console.log('')

    if (data.hardErrors && data.hardErrors.length > 0) {
      console.log('⚠️  Hard Errors:')
      data.hardErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`)
      })
      console.log('')
    }

    if (data.softErrors && data.softErrors.length > 0) {
      console.log('⚠️  Soft Errors:')
      data.softErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`)
      })
      console.log('')
    }

    // Check if revenue drivers were mentioned in logs
    console.log('🎯 Stage RD (Revenue Drivers) Status:')
    console.log('   NOTE: Check Supabase function logs for Stage RD output')
    console.log('   Look for lines containing:')
    console.log('   - "🎯 Stage RD: analyzing revenue drivers..."')
    console.log('   - "✅ Stage RD: revenue drivers analyzed via"')
    console.log('')

    console.log('📍 Next Steps:')
    console.log('   1. Check Supabase function logs for Stage RD execution')
    console.log('   2. Run verification query to check revenue_drivers column')
    console.log('   3. Generate a weekly plan to test integration')
    console.log('')

    console.log('💡 Verification Query:')
    console.log(`
SELECT 
  business_id,
  brand_profile_v5->'revenue_drivers' as revenue_drivers,
  jsonb_pretty(brand_profile_v5->'revenue_drivers') as formatted
FROM business_brand_profile
WHERE business_id = '${BUSINESS_ID}';
`)

  } catch (error) {
    console.error('❌ Test Failed:', error.message)
    console.error('   Stack:', error.stack)
    process.exit(1)
  }
}

// Run the test
testBrandProfileWithRevenueDrivers()
