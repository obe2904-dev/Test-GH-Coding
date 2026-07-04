#!/usr/bin/env node
/**
 * Simple check of menu_sources data structure
 * Using fetch API to query Supabase REST API
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔍 Checking menu_sources labels for Cafe Faust...\n')

try {
  // 1. Get menu_results_v2 with joined menu_sources
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/menu_results_v2?business_id=eq.${CAFE_FAUST_ID}&status=eq.done&language_code=eq.da&select=service_period_name,source_url,menu_sources!menu_results_v2_source_id_fkey(label,menu_type)`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ HTTP ${response.status}: ${errorText}`)
    process.exit(1)
  }

  const results = await response.json()
  console.log(`Found ${results.length} menu results:\n`)
  
  results.forEach((result, i) => {
    const menuSource = result.menu_sources
    const label = menuSource?.label?.toLowerCase() || ''
    const isDrinks = label.includes('cocktail') || label.includes('drink') || label.includes('wine') || label.includes('vin') || label.includes('bar')
    
    console.log(`${i + 1}. Service Period: ${result.service_period_name || '(none)'}`)
    console.log(`   URL: ${result.source_url || '(none)'}`)
    console.log(`   menu_sources.label: ${menuSource?.label || '(none)'}`)
    console.log(`   menu_sources.menu_type: ${menuSource?.menu_type || '(none)'}`)
    console.log(`   🔍 Detected as: ${isDrinks ? '🍸 DRINKS-ONLY (exclude)' : '🍽️ FOOD (include)'}`)
    console.log('')
  })
  
  const drinksCount = results.filter(r => {
    const label = r.menu_sources?.label?.toLowerCase() || ''
    return label.includes('cocktail') || label.includes('drink') || label.includes('wine') || label.includes('vin') || label.includes('bar')
  }).length
  
  console.log(`\n📊 Summary:`)
  console.log(`  Total menus: ${results.length}`)
  console.log(`  Drinks menus (to exclude): ${drinksCount}`)
  console.log(`  Food menus (to include): ${results.length - drinksCount}`)
  
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
