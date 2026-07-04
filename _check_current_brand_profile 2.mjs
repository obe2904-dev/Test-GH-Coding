#!/usr/bin/env node
/**
 * Check current brand profile programmes for Cafe Faust
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('📊 Checking current brand profile for Cafe Faust...\n')

// Get business_profile record
const { data: profile, error } = await supabase
  .from('business_profile')
  .select('menu_signal')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('language', 'da')
  .single()

if (error) {
  console.error('❌ Error fetching profile:', error.message)
  process.exit(1)
}

if (!profile) {
  console.log('⚠️ No profile found')
  process.exit(0)
}

console.log('✅ Found brand profile\n')

if (profile.menu_signal?.programmes) {
  console.log('📋 Programmes in menu_signal:')
  profile.menu_signal.programmes.forEach((prog, i) => {
    console.log(`\n${i + 1}. ${prog.role}`)
    console.log(`   Time: ${prog.timeContext || '(none)'}`)
    console.log(`   Items: ${prog.items?.length || 0}`)
    if (prog.items && prog.items.length > 0) {
      console.log(`   Sample items: ${prog.items.slice(0, 3).join(', ')}`)
    }
  })
  
  console.log(`\n📊 Total: ${profile.menu_signal.programmes.length} programmes`)
  console.log('\n🎯 Expected: 3 (MENUKORT, FROKOST, Brunch)')
  console.log('🍸 AFTEN should be filtered out (cocktails only)')
} else {
  console.log('⚠️ No programmes found in menu_signal')
}

// Also check menu_results_v2 to see labels
console.log('\n\n🔍 Checking menu_results_v2 labels...\n')

const { data: menuResults, error: menuError } = await supabase
  .from('menu_results_v2')
  .select('service_period_name, source_id')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('status', 'done')
  .eq('language_code', 'da')

if (menuError) {
  console.error('❌ Error fetching menu results:', menuError.message)
} else if (menuResults) {
  console.log(`Found ${menuResults.length} menu results:`)
  for (const mr of menuResults) {
    // Get menu_source for this result
    const { data: menuSource } = await supabase
      .from('menu_sources')
      .select('label, menu_type')
      .eq('id', mr.source_id)
      .single()
    
    console.log(`\n  • ${mr.service_period_name || '(no name)'}`)
    console.log(`    Source ID: ${mr.source_id}`)
    console.log(`    Label: ${menuSource?.label || '(none)'}`)
    console.log(`    Type: ${menuSource?.menu_type || '(none)'}`)
  }
}
