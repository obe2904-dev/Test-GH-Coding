#!/usr/bin/env node
/**
 * Check menu_sources labels for Cafe Faust
 * Shows what labels are set for each menu to understand drinks detection
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'
const supabase = createClient(supabaseUrl, supabaseKey)

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔍 Checking menu_sources labels for Cafe Faust...\n')

// 1. Get all menu_sources for Cafe Faust
const { data: menuSources, error: sourcesError } = await supabase
  .from('menu_sources')
  .select('id, label, menu_type, source_url, status')
  .eq('business_id', CAFE_FAUST_ID)
  .order('created_at', { ascending: false })

if (sourcesError) {
  console.error('❌ Error fetching menu_sources:', sourcesError.message)
  process.exit(1)
}

console.log(`Found ${menuSources.length} menu sources:\n`)
menuSources.forEach((source, i) => {
  console.log(`${i + 1}. ${source.source_url}`)
  console.log(`   Label: ${source.label || '(none)'}`)
  console.log(`   Menu Type: ${source.menu_type}`)
  console.log(`   Status: ${source.status}`)
  console.log('')
})

// 2. Get menu_results_v2 with JOIN to menu_sources
const { data: menuResults, error: resultsError } = await supabase
  .from('menu_results_v2')
  .select(`
    service_period_name,
    source_url,
    language_code,
    status,
    menu_sources!menu_results_v2_source_id_fkey(label, menu_type)
  `)
  .eq('business_id', CAFE_FAUST_ID)
  .eq('status', 'done')
  .eq('language_code', 'da')

if (resultsError) {
  console.error('❌ Error fetching menu_results_v2:', resultsError.message)
  process.exit(1)
}

console.log(`\n📊 Menu Results V2 (Danish, Done):\n`)
menuResults.forEach((result, i) => {
  const menuSource = result.menu_sources
  console.log(`${i + 1}. Service Period: ${result.service_period_name || '(none)'}`)
  console.log(`   Source URL: ${result.source_url || '(none)'}`)
  console.log(`   menu_sources.label: ${menuSource?.label || '(none)'}`)
  console.log(`   menu_sources.menu_type: ${menuSource?.menu_type || '(none)'}`)
  
  // Detect if drinks-only based on label
  const label = menuSource?.label?.toLowerCase() || ''
  const isDrinks = label.includes('cocktail') || label.includes('drink') || label.includes('wine') || label.includes('vin') || label.includes('bar')
  console.log(`   🔍 Drinks-only? ${isDrinks ? '🍸 YES' : '🍽️ NO'}`)
  console.log('')
})

console.log('\n✅ Done!')
