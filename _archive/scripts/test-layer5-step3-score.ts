/**
 * LAYER 5 TEST - STEP 3: TEST MENU SCORING
 * 
 * Run with: deno run --allow-env --allow-net test-layer5-step3-score.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { scoreMenuItems, getCurrentSeason } from './supabase/functions/_shared/post-helpers/menu-scorer.ts'

// Load .env file manually
const envFile = await Deno.readTextFile('.env');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length) {
      env[key] = values.join('=');
    }
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env')
  Deno.exit(1)
}

// Replace with your test business ID
const TEST_BUSINESS_ID = '840347de-9ba7-4275-8aa3-4553417fc2af'

async function testMenuScoring() {
  console.log('🧪 LAYER 5 TEST - Menu Scoring Engine\n')
  
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  
  // Verify business exists
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, avg_engagement_rate, country_code')
    .eq('id', TEST_BUSINESS_ID)
    .single()
  
  if (businessError || !business) {
    console.error('❌ Business not found. ID used:', TEST_BUSINESS_ID)
    console.log('\nRun this SQL to verify:')
    console.log(`SELECT id FROM businesses WHERE id = '${TEST_BUSINESS_ID}';`)
    Deno.exit(1)
  }
  
  console.log(`✅ Testing with business ID: ${business.id}`)
  console.log(`   Country: ${business.country_code || 'DK'}`)
  console.log(`   Avg engagement: ${((business.avg_engagement_rate || 0.05) * 100).toFixed(1)}%\n`)
  
  // Build scoring context (simulate spring, mild weather)
  const currentMonth = 4 // April
  const season = getCurrentSeason(currentMonth)
  
  const context = {
    businessId: TEST_BUSINESS_ID,
    season,
    currentMonth,
    weatherForecast: {
      avgTemp: 18, // Nice spring weather
      condition: 'sunny'
    },
    locationScores: {
      waterfront: 75,
      tourist_area: 60
    },
    businessAvgEngagement: business.avg_engagement_rate || 0.05,
    countryCode: business.country_code || 'DK'
  }
  
  console.log('📊 Scoring Context:')
  console.log(`   Season: ${season}`)
  console.log(`   Month: ${currentMonth} (April)`)
  console.log(`   Weather: ${context.weatherForecast.condition}, ${context.weatherForecast.avgTemp}°C`)
  console.log(`   Location: Waterfront (${context.locationScores.waterfront}), Tourist (${context.locationScores.tourist_area})`)
  console.log('')
  
  // Score menu items
  console.log('⚡ Scoring menu items...\n')
  const scores = await scoreMenuItems(context)
  
  if (scores.length === 0) {
    console.log('❌ No menu items found. Run test-layer5-step2-populate.sql first.')
    Deno.exit(1)
  }
  
  console.log(`📋 Results: ${scores.length} menu items scored\n`)
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  // Display top 5 scores
  const top5 = scores.slice(0, 5)
  
  for (let i = 0; i < top5.length; i++) {
    const item = top5[i]
    const rank = i + 1
    
    console.log(`${rank}. ${item.itemName}`)
    console.log(`   Category: ${item.itemCategory}`)
    console.log(`   Final Score: ${item.finalScore} points`)
    console.log(`   Post-Worthiness: ${item.postWorthiness.toUpperCase()}`)
    console.log(`   Reason: ${item.reason}`)
    console.log('')
    console.log('   Score Breakdown:')
    console.log(`     Base Score: ${item.baseScore}`)
    console.log(`     + Seasonal: ${item.bonuses.seasonal}`)
    console.log(`     + Weather: ${item.bonuses.weather}`)
    console.log(`     + Location: ${item.bonuses.location}`)
    console.log(`     + Performance: ${item.bonuses.performance}`)
    console.log(`     + Newness: ${item.bonuses.newness}`)
    console.log(`     - Recency: ${item.penalties.recency}`)
    console.log('')
    console.log('   Details:')
    item.details.forEach(detail => console.log(`     • ${detail}`))
    console.log('')
    console.log('───────────────────────────────────────────────────────────────\n')
  }
  
  // Show blocked items
  const blocked = scores.filter(s => s.postWorthiness === 'blocked')
  if (blocked.length > 0) {
    console.log(`⛔ Blocked Items (${blocked.length}):`)
    blocked.forEach(item => {
      console.log(`   • ${item.itemName}: ${item.reason}`)
    })
    console.log('')
  }
  
  // Summary statistics
  const critical = scores.filter(s => s.postWorthiness === 'critical').length
  const high = scores.filter(s => s.postWorthiness === 'high').length
  const medium = scores.filter(s => s.postWorthiness === 'medium').length
  const low = scores.filter(s => s.postWorthiness === 'low').length
  
  console.log('📊 Summary:')
  console.log(`   Critical opportunities: ${critical}`)
  console.log(`   High priority: ${high}`)
  console.log(`   Medium priority: ${medium}`)
  console.log(`   Low priority: ${low}`)
  console.log(`   Blocked: ${blocked.length}`)
  console.log('')
  
  console.log('✅ Menu scoring test complete!')
  console.log('\nNext: Run test-layer5-step4-opportunities.ts to test compound opportunities')
}

// Run test
testMenuScoring().catch(console.error)
