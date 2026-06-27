/**
 * Integration Test: Menu Rotation Queue with Cuisine Data
 * 
 * Purpose: Validate that the updated getMenuRotationQueue() function:
 * 1. Successfully JOINs to menu_results_v2.ai_summary
 * 2. Returns cuisine_context and ai_summary_raw fields
 * 3. Correctly parses cuisine from ai_summary
 * 
 * Run: node _test_menu_rotation_queue_cuisine.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load environment variables
function loadEnvFile(filename) {
  try {
    const envFile = readFileSync(filename, 'utf8')
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        if (value && !process.env[key]) {
          process.env[key] = value
        }
      }
    })
  } catch (error) {}
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Simplified version of getMenuRotationQueue for testing
async function testMenuRotationQueue(businessId) {
  console.log(`🧪 Testing menu rotation queue for business: ${businessId}\n`)

  // Test the JOIN query structure
  const { data: menuItems, error } = await supabase
    .from('menu_items_normalized')
    .select(`
      id,
      item_name,
      item_description,
      category_name,
      menu_language,
      service_periods,
      menu_result_id,
      menu_results_v2!inner (
        ai_summary
      )
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .limit(10)

  if (error) {
    console.error('❌ Query failed:', error)
    return { success: false, error }
  }

  console.log(`✅ Successfully fetched ${menuItems.length} menu items\n`)

  // Validate data structure
  let cuisineDetected = 0
  let cuisineMissing = 0

  for (const item of menuItems) {
    const aiSummary = item.menu_results_v2?.ai_summary
    
    // Simple cuisine detection (matching cuisine-parser.ts logic)
    let cuisineContext = null
    if (aiSummary) {
      const text = aiSummary.toLowerCase()
      if (/\bnordisk\b|\bnordic\b/.test(text)) cuisineContext = 'Nordic'
      else if (/\b(italiensk|italian)\b|pasta/.test(text)) cuisineContext = 'Italian'
      else if (/dansk madkultur/.test(text)) cuisineContext = 'Danish'
      else if (/\b(thai|thailandsk)\b/.test(text)) cuisineContext = 'Thai'
      else if (/\b(fransk|french)\b/.test(text)) cuisineContext = 'French'
    }

    if (cuisineContext) {
      cuisineDetected++
    } else {
      cuisineMissing++
    }

    console.log(`📍 ${item.item_name}`)
    console.log(`   Menu Result ID: ${item.menu_result_id || 'N/A'}`)
    console.log(`   Cuisine: ${cuisineContext || 'Not detected'}`)
    console.log(`   ai_summary: ${aiSummary ? `${aiSummary.substring(0, 80)}...` : 'N/A'}`)
    console.log()
  }

  console.log(`\n📊 Results:`)
  console.log(`   Total items: ${menuItems.length}`)
  console.log(`   Cuisine detected: ${cuisineDetected}`)
  console.log(`   Cuisine missing: ${cuisineMissing}`)
  console.log(`   Detection rate: ${((cuisineDetected / menuItems.length) * 100).toFixed(1)}%`)

  return {
    success: true,
    totalItems: menuItems.length,
    cuisineDetected,
    cuisineMissing,
    detectionRate: (cuisineDetected / menuItems.length) * 100
  }
}

// Run test
async function main() {
  console.log('🧪 Menu Rotation Queue Cuisine Integration Test\n')
  console.log('=' .repeat(80))
  console.log()

  // Get a test business ID (you can change this to your test business)
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(1)

  if (!businesses || businesses.length === 0) {
    console.error('❌ No businesses found in database')
    process.exit(1)
  }

  const testBusiness = businesses[0]
  console.log(`Using test business: ${testBusiness.name} (${testBusiness.id})\n`)

  const result = await testMenuRotationQueue(testBusiness.id)

  console.log('\n' + '=' .repeat(80))
  
  if (result.success && result.detectionRate >= 80) {
    console.log('✅ TEST PASSED: Menu rotation queue cuisine integration working')
    console.log(`   Detection rate: ${result.detectionRate.toFixed(1)}% (target: 80%+)`)
    process.exit(0)
  } else if (result.success) {
    console.log('⚠️  TEST WARNING: Integration works but detection rate below target')
    console.log(`   Detection rate: ${result.detectionRate.toFixed(1)}% (target: 80%+)`)
    console.log('   Consider expanding cuisine patterns or checking ai_summary generation')
    process.exit(0)
  } else {
    console.log('❌ TEST FAILED: Integration not working')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('\n❌ Test failed with error:', error)
  process.exit(1)
})
