/**
 * Test Programme Detection V2
 * 
 * Validates that V2 detection correctly reads menu_results_v2 and
 * produces accurate programme profiles with extracted time windows.
 */

import { createClient } from '@supabase/supabase-js'

// Use service role key for full database access
const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

async function testDetection(businessId: string, businessName: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Testing V2 Detection: ${businessName}`)
  console.log('='.repeat(70))
  
  // Fetch menu extractions
  const { data: menuResults, error: menuError } = await supabase
    .from('menu_results_v2')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
  
  if (menuError) {
    console.error('❌ Error fetching menu results:', menuError)
    return
  }
  
  // Fetch opening hours
  const { data: openingHours, error: hoursError } = await supabase
    .from('opening_hours')
    .select('*')
    .eq('business_id', businessId)
  
  if (hoursError) {
    console.error('❌ Error fetching opening hours:', hoursError)
    return
  }
  
  // Fetch business
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()
  
  if (bizError) {
    console.error('❌ Error fetching business:', bizError)
    return
  }
  
  console.log(`\n📊 Input Data:`)
  console.log(`   Business: ${business.name}`)
  console.log(`   Menu extractions: ${menuResults?.length || 0} completed`)
  console.log(`   Opening hours: ${openingHours?.length || 0} entries`)
  
  if (menuResults && menuResults.length > 0) {
    console.log(`\n📋 Menu Extraction Details:`)
    menuResults.forEach((mr, idx) => {
      const data = mr.structured_data
      const itemCount = data?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0
      
      console.log(`\n   ${idx + 1}. ${mr.source_url}`)
      console.log(`      └─ menuTitle: ${data?.menuTitle || '(none)'}`)
      console.log(`      └─ availabilityTime: ${data?.availabilityTime || '(none)'}`)
      console.log(`      └─ availabilityDays: ${data?.availabilityDays || '(none)'}`)
      console.log(`      └─ categories: ${data?.categories?.length || 0}`)
      console.log(`      └─ items: ${itemCount}`)
    })
  }
  
  // Call V5 generator to test detection
  console.log(`\n🧪 Testing V5 Generation with V2 Detection...`)
  
  const { data: response, error: genError } = await supabase.functions.invoke(
    'brand-profile-generator-v5',
    {
      body: {
        businessId: businessId,
        forceRegenerate: true
      }
    }
  )
  
  if (genError) {
    console.error('❌ Generation error:', genError)
    
    // Try to read the response body to see the actual error
    if (genError.context) {
      try {
        const errorBody = await genError.context.text()
        console.error('Error details:', errorBody)
      } catch (e) {
        console.error('Could not read error details')
      }
    }
    return
  }
  
  console.log(`\n✅ Generation complete!`)
  
  // Fetch generated programmes
  const { data: programmes, error: progError } = await supabase
    .from('business_programme_profiles')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  
  if (progError) {
    console.error('❌ Error fetching programmes:', progError)
    return
  }
  
  console.log(`\n🎯 Detection Results:`)
  console.log(`   Programmes detected: ${programmes?.length || 0}`)
  
  if (programmes && programmes.length > 0) {
    programmes.forEach((prog, idx) => {
      console.log(`\n   ${idx + 1}. ${prog.programme_name} (${prog.programme_type})`)
      console.log(`      └─ Time: ${prog.time_windows.join(', ')}`)
      console.log(`      └─ Days: ${prog.operating_days.join(', ')}`)
      console.log(`      └─ Confidence: ${(prog.confidence * 100).toFixed(0)}%`)
      console.log(`      └─ Menu evidence: ${prog.menu_evidence.length} items`)
      
      if (prog.menu_evidence.length > 0 && prog.menu_evidence.length <= 5) {
        prog.menu_evidence.forEach((ev: string) => {
          console.log(`         • ${ev}`)
        })
      } else if (prog.menu_evidence.length > 5) {
        prog.menu_evidence.slice(0, 3).forEach((ev: string) => {
          console.log(`         • ${ev}`)
        })
        console.log(`         ... and ${prog.menu_evidence.length - 3} more`)
      }
    })
  }
  
  // Validation checks
  console.log(`\n✅ Validation:`)
  
  const expectedProgrammes = 4
  if (programmes && programmes.length === expectedProgrammes) {
    console.log(`   ✅ Programme count: ${programmes.length}/${expectedProgrammes} (PASS)`)
  } else {
    console.log(`   ❌ Programme count: ${programmes?.length || 0}/${expectedProgrammes} (FAIL)`)
  }
  
  // Check for specific programmes
  const programmeTypes = new Set(programmes?.map(p => p.programme_type) || [])
  const expectedTypes = ['morning', 'lunch', 'dinner', 'bar']
  
  expectedTypes.forEach(type => {
    if (programmeTypes.has(type)) {
      console.log(`   ✅ ${type} programme detected`)
    } else {
      console.log(`   ❌ ${type} programme MISSING`)
    }
  })
  
  // Check time windows are not hardcoded
  const aftenProgramme = programmes?.find(p => p.programme_type === 'dinner')
  if (aftenProgramme) {
    const timeWindow = aftenProgramme.time_windows[0]
    if (timeWindow === '17:00-22:00') {
      console.log(`   ❌ Dinner time: ${timeWindow} (hardcoded - FAIL)`)
    } else if (timeWindow.includes('17:30') || timeWindow.includes('21:30')) {
      console.log(`   ✅ Dinner time: ${timeWindow} (extracted - PASS)`)
    } else {
      console.log(`   ⚠️  Dinner time: ${timeWindow} (unexpected)`)
    }
  }
  
  const morningProgramme = programmes?.find(p => p.programme_type === 'morning')
  if (morningProgramme) {
    const timeWindow = morningProgramme.time_windows[0]
    if (timeWindow === '07:00-11:00') {
      console.log(`   ❌ Morning time: ${timeWindow} (hardcoded - FAIL)`)
    } else if (timeWindow.includes('09:00')) {
      console.log(`   ✅ Morning time: ${timeWindow} (extracted - PASS)`)
    } else {
      console.log(`   ⚠️  Morning time: ${timeWindow} (unexpected)`)
    }
  }
}

// Run test
console.log('\n🧪 Programme Detection V2 Test Suite')
console.log('=====================================\n')

await testDetection(CAFE_FAUST_ID, 'Café Faust')

console.log(`\n${'='.repeat(70)}`)
console.log('Test complete!')
console.log('='.repeat(70) + '\n')
