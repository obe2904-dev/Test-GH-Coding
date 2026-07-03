/**
 * Test Programme Detection V2 - Layer 1 Only
 * 
 * Tests only the programme detection logic without running the full V5 generation.
 * This avoids issues with Layers 2-4 that are unrelated to detection.
 */

import { createClient } from '@supabase/supabase-js'
import { detectProgrammesV2 } from '../supabase/functions/_shared/brand-profile/programme-detection-v2.ts'

// Use service role key for full database access
const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

async function testDetectionOnly() {
  console.log('\n🔍 Testing V2 Detection Logic Directly\n')
  
  // Fetch menu extractions
  const { data: menuResults } = await supabase
    .from('menu_results_v2')
    .select('id, business_id, source_url, status, structured_data, completed_at, language_code')
    .eq('business_id', CAFE_FAUST_ID)
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
  
  // Fetch opening hours
  const { data: openingHours } = await supabase
    .from('opening_hours')
    .select('*')
    .eq('business_id', CAFE_FAUST_ID)
  
  // Fetch business
  const { data: business } = await supabase
    .from('business')
    .select('*')
    .eq('id', CAFE_FAUST_ID)
    .single()
  
  console.log(`📊 Input Data:`)
  console.log(`   Business: ${business?.name}`)
  console.log(`   Menu extractions: ${menuResults?.length || 0}`)
  console.log(`   Opening hours: ${openingHours?.length || 0}`)
  
  // Run V2 detection directly
  console.log(`\n🧪 Running V2 Detection...\n`)
  
  const result = detectProgrammesV2(
    menuResults || [],
    openingHours || [],
    business
  )
  
  console.log(`✅ Detection Method: ${result.detectionMethod}`)
  console.log(`✅ Total Programmes: ${result.totalProgrammes}`)
  
  console.log(`\n📋 Detected Programmes:\n`)
  
  result.programmes.forEach((prog, idx) => {
    console.log(`   ${idx + 1}. ${prog.label} (${prog.type})`)
    console.log(`      ├─ Time: ${prog.timeWindow.start} - ${prog.timeWindow.end}`)
    console.log(`      ├─ Days: ${prog.daysOfWeek.join(', ')}`)
    console.log(`      ├─ Confidence: ${prog.confidence}`)
    console.log(`      ├─ Source: ${prog.metadata?.source}`)
    console.log(`      ├─ Menu: ${prog.metadata?.menuTitle || 'N/A'}`)
    console.log(`      ├─ URL: ${prog.metadata?.url}`)
    console.log(`      └─ Items: ${prog.metadata?.itemCount} across ${prog.metadata?.categoryCount} categories`)
  })
  
  // Validation
  console.log(`\n🎯 Validation:\n`)
  
  const expectedCount = 4 // morning/brunch, lunch, dinner, bar/cocktails
  const actualCount = result.totalProgrammes
  
  if (actualCount >= expectedCount) {
    console.log(`   ✅ Programme count: ${actualCount} (expected ${expectedCount}+)`)
  } else {
    console.log(`   ❌ Programme count: ${actualCount} (expected ${expectedCount}+)`)
  }
  
  // Check if times are extracted (not hardcoded)
  const dinnerProg = result.programmes.find(p => p.type === 'dinner')
  if (dinnerProg) {
    const expectedTime = '17:30' // Extracted from "17.30-21.30"
    const actualTime = dinnerProg.timeWindow.start
    
    if (actualTime === expectedTime) {
      console.log(`   ✅ Dinner start time: ${actualTime} (extracted, not hardcoded)`)
    } else {
      console.log(`   ⚠️  Dinner start time: ${actualTime} (expected ${expectedTime})`)
    }
  }
  
  // Check detection method
  if (result.detectionMethod === 'extraction') {
    console.log(`   ✅ Detection method: extraction (V2 working correctly)`)
  } else {
    console.log(`   ❌ Detection method: ${result.detectionMethod} (expected 'extraction')`)
  }
  
  console.log()
}

// Run test
console.log('\n🧪 Programme Detection V2 - Direct Test')
console.log('='.repeat(70) + '\n')

await testDetectionOnly()

console.log('\n' + '='.repeat(70))
console.log('Test complete!')
console.log('='.repeat(70) + '\n')
