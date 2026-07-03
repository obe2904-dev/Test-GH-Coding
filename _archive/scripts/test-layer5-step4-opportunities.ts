/**
 * LAYER 5 TEST - STEP 4: TEST COMPOUND OPPORTUNITIES
 * 
 * Run with: deno run --allow-env --allow-net test-layer5-step4-opportunities.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { detectCompoundOpportunities } from './supabase/functions/_shared/post-helpers/compound-opportunities.ts'

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const TEST_BUSINESS_ID = '840347de-9ba7-4275-8aa3-4553417fc2af'

async function testCompoundOpportunities() {
  console.log('🧪 LAYER 5 TEST - Compound Opportunities Detector\n')
  
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  
  // Build location context
  const locationContext = {
    categoryScores: {
      waterfront: 85,
      outdoor_seating: 70,
      tourist_area: 60
    },
    outdoorSeating: true,
    areaType: 'urban' as const,
    servicePeriods: ['breakfast', 'lunch', 'dinner'],
    primaryServicePeriod: 'dinner'
  }
  
  // Simulate spring weather forecast (3 consecutive warm days)
  const weatherForecast = [
    {
      date: '2026-04-15',
      temp: { day: 18, night: 10 },
      condition: 'clear' as const,
      description: 'Sunny',
      windSpeed: 10
    },
    {
      date: '2026-04-16',
      temp: { day: 19, night: 11 },
      condition: 'clear' as const,
      description: 'Sunny',
      windSpeed: 8
    },
    {
      date: '2026-04-17',
      temp: { day: 20, night: 12 },
      condition: 'partly_cloudy' as const,
      description: 'Partly Cloudy',
      windSpeed: 12
    }
  ]
  
  console.log('📊 Context:')
  console.log(`   Location: Waterfront (85), Tourist area (60), Outdoor seating ✓`)
  console.log(`   Weather: 3 days of warm weather (18-20°C, sunny)`)
  console.log(`   Season: Spring`)
  console.log('')
  
  console.log('⚡ Detecting opportunities...\n')
  
  const opportunities = await detectCompoundOpportunities(
    locationContext,
    weatherForecast,
    'spring',
    TEST_BUSINESS_ID,
    supabase,
    12 // Noon
  )
  
  console.log(`📋 Results: ${opportunities.length} opportunities detected\n`)
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  if (opportunities.length === 0) {
    console.log('ℹ️ No opportunities detected with current context.')
    console.log('   This is normal - opportunities are context-dependent.')
    console.log('\nTry adjusting:')
    console.log('   • Season (terrace opening in spring)')
    console.log('   • Weather (heatwave, cold snap)')
    console.log('   • Performance data (for team spotlight)')
    console.log('   • Calendar events (for event announcements)')
  }
  
  opportunities.forEach((opp, i) => {
    console.log(`${i + 1}. ${opp.contentAngle}`)
    console.log(`   Priority: ${opp.priority.toUpperCase()}`)
    console.log(`   Score: ${opp.score}`)
    console.log(`   Platform: ${opp.platformPriority}`)
    console.log(`   Time-Sensitive: ${opp.isTimeSensitive ? '⚠️ YES' : 'No'}`)
    console.log('')
    console.log('   Triggers:')
    console.log(`     Location: ${opp.triggers.location.join(', ')}`)
    console.log(`     Weather: ${opp.triggers.weather.join(', ')}`)
    console.log(`     Season: ${opp.triggers.season}`)
    if (opp.triggers.timing?.length) {
      console.log(`     Timing: ${opp.triggers.timing.join(', ')}`)
    }
    console.log('')
    console.log('   Content Types:')
    opp.contentTypes.forEach(type => console.log(`     • ${type}`))
    console.log('')
    console.log('   Prompt Hints:')
    opp.promptHints.forEach(hint => console.log(`     • ${hint}`))
    console.log('')
    console.log('───────────────────────────────────────────────────────────────\n')
  })
  
  // Test Pattern 7: Terrace Opening
  console.log('🧪 Testing Pattern 7: Terrace Opening')
  const terracePattern = opportunities.find(o => o.id === 'terrace_opening')
  if (terracePattern) {
    console.log('   ✅ DETECTED - Terrace opening opportunity found!')
    console.log(`   Score: ${terracePattern.score} (should be 250)`)
    console.log(`   Priority: ${terracePattern.priority} (should be critical)`)
  } else {
    console.log('   ℹ️ Not detected (may have been announced this year already)')
  }
  console.log('')
  
  console.log('✅ Compound opportunities test complete!')
  console.log('\nNext: Run test-layer5-step5-weekly-plan.ts to test full weekly planning')
}

testCompoundOpportunities().catch(console.error)
