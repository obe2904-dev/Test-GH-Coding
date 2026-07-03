/**
 * Test Script: Cuisine Integration from menu_results_v2.ai_summary
 * 
 * Purpose: Validate that:
 * 1. menu_results_v2.ai_summary field contains cuisine data
 * 2. JOIN through menu_items_normalized.menu_result_id works
 * 3. Cuisine parsing logic successfully extracts cuisine types
 * 
 * Run: node _test_cuisine_integration.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load environment variables from both .env and .env.local
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
  } catch (error) {
    // File doesn't exist or can't be read, continue
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

// Support both VITE_ and NEXT_PUBLIC_ prefixes
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:')
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗')
  console.error('\nEnsure .env or .env.local file exists with these variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Cuisine detection patterns (refined with word boundaries to avoid false positives)
const CUISINE_PATTERNS = {
  'Thai': /\b(thai|thailandsk)\b/i,
  'Italian': /\b(italiensk|italian)\b|pasta|pizza|risotto/i,
  'French': /\b(fransk|french)\b|bistro|brasserie/i,
  'Nordic': /\bnordisk\b|\bnordic\b|ny nordisk|new nordic/i,
  'Danish': /dansk madkultur|traditional danish|smørrebrød|frikadeller/i,
  'Japanese': /\b(japansk|japanese)\b|sushi|ramen|izakaya/i,
  'Mediterranean': /\bmediterran(ean)?\b/i,
  'Mexican': /\b(mexicansk|mexican)\b|taco|burrito/i,
  'Indian': /\b(indisk|indian)\b|curry|tandoori/i,
  'Middle Eastern': /mellemøstlig|middle eastern|falafel|hummus|mezze/i,
  'Chinese': /\b(kinesisk|chinese)\b|dim sum|wok/i,
  'Spanish': /\b(spansk|spanish)\b|tapas|paella/i,
  'Greek': /\b(græsk|greek)\b|gyros|souvlaki/i,
  'Vietnamese': /\b(vietnamesisk|vietnamese)\b|pho|banh mi/i,
  'Korean': /\b(koreansk|korean)\b|bibimbap|kimchi/i,
}

const APPROACH_PATTERNS = {
  'Traditional': /traditionel|klassisk|autentisk|traditional|classic|authentic/i,
  'Modern': /moderne|ny|contemporary|modern|new/i,
  'Fusion': /møder|meets|fusion|blanding|mix/i,
}

function parseCuisineFromSummary(aiSummary) {
  if (!aiSummary || aiSummary.trim().length === 0) {
    return {
      primary: null,
      secondary: null,
      approach: null,
      confidence: 'none'
    }
  }

  const text = aiSummary.toLowerCase()
  
  // Detect primary cuisine
  let primary = null
  for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
    if (pattern.test(text)) {
      primary = cuisine
      break
    }
  }

  // Detect approach
  let approach = null
  for (const [app, pattern] of Object.entries(APPROACH_PATTERNS)) {
    if (pattern.test(text)) {
      approach = app
      break
    }
  }

  // Detect fusion pattern: "X møder Y" or "X meets Y"
  let secondary = null
  const fusionMatch = text.match(/(\w+)\s+(?:møder|meets)\s+(\w+)/i)
  if (fusionMatch) {
    secondary = fusionMatch[2]
    approach = 'Fusion'
  }

  const confidence = primary ? 'high' : 'none'

  return { primary, secondary, approach, confidence }
}

function formatCuisineDescription(cuisineContext) {
  if (!cuisineContext.primary) return null

  if (cuisineContext.secondary && cuisineContext.approach === 'Fusion') {
    return `${cuisineContext.primary}-${cuisineContext.secondary} fusion`
  }

  if (cuisineContext.approach) {
    return `${cuisineContext.approach} ${cuisineContext.primary}`
  }

  return cuisineContext.primary
}

async function testCuisineIntegration() {
  console.log('🧪 Testing Cuisine Integration from menu_results_v2.ai_summary\n')
  console.log('=' .repeat(80))

  // Test 1: Verify table structure
  console.log('\n📋 TEST 1: Verify Table Structure')
  console.log('-'.repeat(80))
  
  const { data: schemaTest, error: schemaError } = await supabase
    .from('menu_results_v2')
    .select('id, ai_summary')
    .limit(1)

  if (schemaError) {
    console.error('❌ Schema test failed:', schemaError.message)
    return
  }

  console.log('✅ menu_results_v2.ai_summary column exists and is accessible')

  // Test 2: Fetch menu items with JOIN to ai_summary
  console.log('\n📋 TEST 2: JOIN menu_items_normalized → menu_results_v2')
  console.log('-'.repeat(80))

  const { data: menuItems, error: joinError } = await supabase
    .from('menu_items_normalized')
    .select(`
      id,
      item_name,
      item_description,
      menu_result_id,
      service_period_name,
      menu_results_v2!inner (
        id,
        ai_summary,
        service_period_name
      )
    `)
    .eq('is_active', true)
    .not('menu_results_v2.ai_summary', 'is', null)
    .limit(20)

  if (joinError) {
    console.error('❌ JOIN test failed:', joinError.message)
    return
  }

  console.log(`✅ Successfully fetched ${menuItems.length} menu items with ai_summary`)

  if (menuItems.length === 0) {
    console.log('⚠️  No menu items found with ai_summary data')
    console.log('   This may indicate ai_summary field is not populated yet')
    return
  }

  // Test 3: Parse cuisine from each ai_summary
  console.log('\n📋 TEST 3: Cuisine Detection from ai_summary')
  console.log('-'.repeat(80))

  const detectionStats = {
    total: menuItems.length,
    detected: 0,
    notDetected: 0,
    byType: {}
  }

  for (const item of menuItems) {
    const aiSummary = item.menu_results_v2?.ai_summary
    const cuisineContext = parseCuisineFromSummary(aiSummary)
    
    console.log(`\n📍 Menu Item: ${item.item_name}`)
    console.log(`   Service Period: ${item.service_period_name || 'N/A'}`)
    
    if (aiSummary) {
      // Show first 200 chars of ai_summary
      const summaryPreview = aiSummary.length > 200 
        ? aiSummary.substring(0, 200) + '...' 
        : aiSummary
      console.log(`   ai_summary: "${summaryPreview}"`)
    } else {
      console.log(`   ai_summary: [null]`)
    }

    if (cuisineContext.primary) {
      detectionStats.detected++
      detectionStats.byType[cuisineContext.primary] = 
        (detectionStats.byType[cuisineContext.primary] || 0) + 1
      
      const description = formatCuisineDescription(cuisineContext)
      console.log(`   🍽️  Detected: ${description}`)
      console.log(`   Confidence: ${cuisineContext.confidence}`)
    } else {
      detectionStats.notDetected++
      console.log(`   ⚠️  No cuisine detected`)
    }
  }

  // Test 4: Summary Statistics
  console.log('\n📋 TEST 4: Detection Statistics')
  console.log('-'.repeat(80))
  
  const detectionRate = ((detectionStats.detected / detectionStats.total) * 100).toFixed(1)
  console.log(`Total Items Tested: ${detectionStats.total}`)
  console.log(`Cuisine Detected: ${detectionStats.detected}`)
  console.log(`Not Detected: ${detectionStats.notDetected}`)
  console.log(`Detection Rate: ${detectionRate}%`)
  
  console.log('\nCuisine Types Found:')
  Object.entries(detectionStats.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cuisine, count]) => {
      console.log(`  - ${cuisine}: ${count} items`)
    })

  // Test 5: Validation
  console.log('\n📋 TEST 5: Validation')
  console.log('-'.repeat(80))

  const targetDetectionRate = 80
  if (parseFloat(detectionRate) >= targetDetectionRate) {
    console.log(`✅ SUCCESS: Detection rate ${detectionRate}% meets target (${targetDetectionRate}%+)`)
    console.log('✅ Cuisine integration is viable for production implementation')
  } else {
    console.log(`⚠️  WARNING: Detection rate ${detectionRate}% below target (${targetDetectionRate}%+)`)
    console.log('   Consider:')
    console.log('   1. Review ai_summary generation in menu-extract-v2')
    console.log('   2. Expand CUISINE_PATTERNS regex')
    console.log('   3. Add fallback detection strategies')
  }

  // Test 6: Sample photo guidance generation
  console.log('\n📋 TEST 6: Sample Photo Guidance (Preview)')
  console.log('-'.repeat(80))

  const photoTemplates = {
    'Thai': 'Overhead 90°, bright daylight, fresh herbs and lime visible, vibrant colors',
    'Italian': 'Overhead 45°, natural bright, garnish visible, contrasting plate color',
    'French': '45° table height, warm ambient, rustic ceramic dish, bread/wine in background',
    'Nordic': 'Eye level, soft diffused, minimal plating, ingredient textures visible',
    'Danish': '45° table height, natural bright, rye bread visible, Nordic aesthetic',
    'default': 'Overhead 45°, natural bright, dish centered, garnish visible'
  }

  const sampleItems = menuItems.slice(0, 5)
  for (const item of sampleItems) {
    const cuisineContext = parseCuisineFromSummary(item.menu_results_v2?.ai_summary)
    const photoKey = cuisineContext.primary || 'default'
    const photoGuidance = photoTemplates[photoKey] || photoTemplates['default']
    
    console.log(`\n   ${item.item_name}`)
    console.log(`   → Cuisine: ${cuisineContext.primary || 'Unknown'}`)
    console.log(`   → Photo: "${photoGuidance}"`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Test Complete')
  console.log('='.repeat(80))
  
  return {
    success: parseFloat(detectionRate) >= targetDetectionRate,
    detectionRate: parseFloat(detectionRate),
    stats: detectionStats
  }
}

// Run the test
testCuisineIntegration()
  .then(result => {
    if (result && result.success) {
      console.log('\n🎉 All tests passed! Ready to proceed with Phase 0 implementation.')
      process.exit(0)
    } else {
      console.log('\n⚠️  Tests completed with warnings. Review results above.')
      process.exit(0)
    }
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error)
    process.exit(1)
  })
