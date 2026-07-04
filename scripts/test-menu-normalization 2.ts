/**
 * Test Menu Normalization - Validate Step 5 Implementation
 * 
 * Tests that:
 * 1. Menu extraction creates normalized items automatically
 * 2. Layer 1 programme detection can read the normalized data
 * 3. Service periods are correctly mapped
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-menu-normalization.ts
 * 
 * @date May 7, 2026
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('='['repeat'](70))
console.log('  MENU NORMALIZATION TEST')
console.log('='['repeat'](70))
console.log('')

// Test 1: Check that normalization is enabled
console.log('TEST 1: Trigger Exists')
console.log('-'['repeat'](70))

const { data: triggers } = await supabase.rpc('pg_get_triggerdef', {
  trigger_oid: 'trigger_sync_menu_items_on_extraction'
}).select()

console.log('✅ Checking for normalization trigger...')
// We can't easily check this via RPC, so we'll check indirectly

// Test 2: Find a business with extracted menus
console.log('')
console.log('TEST 2: Find Test Data')
console.log('-'['repeat'](70))

const { data: businesses } = await supabase
  .from('businesses')
  .select('id, name')
  .limit(5)

if (!businesses || businesses.length === 0) {
  console.error('❌ No businesses found in database')
  Deno.exit(1)
}

console.log(`Found ${businesses.length} businesses:`)
businesses.forEach(b => console.log(`   - ${b.name} (${b.id})`))

// Pick first business with extracted menus
let testBusinessId: string | null = null
let testBusinessName: string | null = null

for (const business of businesses) {
  const { data: menus } = await supabase
    .from('menu_results_v2')
    .select('id')
    .eq('business_id', business.id)
    .eq('status', 'done')
    .limit(1)
  
  if (menus && menus.length > 0) {
    testBusinessId = business.id
    testBusinessName = business.name
    break
  }
}

if (!testBusinessId) {
  console.log('⚠️  No businesses with extracted menus found')
  console.log('   Run menu extraction first, then re-run this test')
  Deno.exit(0)
}

console.log(`✅ Using test business: ${testBusinessName}`)

// Test 3: Check extracted menus
console.log('')
console.log('TEST 3: Extracted Menus')
console.log('-'['repeat'](70))

const { data: extractedMenus } = await supabase
  .from('menu_results_v2')
  .select('id, source_url, status, structured_data')
  .eq('business_id', testBusinessId)
  .eq('status', 'done')

console.log(`Found ${extractedMenus?.length || 0} extracted menus`)
extractedMenus?.forEach(menu => {
  const categories = menu.structured_data?.categories || []
  const itemCount = categories.reduce((sum: number, cat: any) => 
    sum + (cat.items?.length || 0), 0)
  console.log(`   - ${menu.source_url}`)
  console.log(`     Categories: ${categories.length}, Items: ${itemCount}`)
})

if (!extractedMenus || extractedMenus.length === 0) {
  console.log('❌ No extracted menus found for this business')
  Deno.exit(1)
}

// Test 4: Check normalized items
console.log('')
console.log('TEST 4: Normalized Items')
console.log('-'['repeat'](70))

const { data: normalizedItems } = await supabase
  .from('menu_items_normalized')
  .select('*')
  .eq('business_id', testBusinessId)
  .order('created_at', { ascending: false })

console.log(`Found ${normalizedItems?.length || 0} normalized items`)

if (!normalizedItems || normalizedItems.length === 0) {
  console.log('❌ FAIL: No normalized items found!')
  console.log('   Expected: Items should be automatically normalized when extraction completes')
  console.log('   Action: Check if trigger is enabled and functioning')
  Deno.exit(1)
}

console.log('✅ PASS: Normalized items exist')
console.log('')

// Show sample items
console.log('Sample normalized items:')
normalizedItems.slice(0, 5).forEach(item => {
  console.log(`   - ${item.item_name} (${item.category_name})`)
  console.log(`     Type: ${item.category_type}`)
  console.log(`     Service periods: ${item.service_periods?.join(', ') || 'none'}`)
  console.log(`     Menu: ${item.menu_title || 'unknown'}`)
  console.log(`     Price: ${item.item_price || 'n/a'}`)
  console.log('')
})

// Test 5: Validate service period mapping
console.log('TEST 5: Service Period Mapping')
console.log('-'['repeat'](70))

const servicePeriodsFound = new Set<string>()
normalizedItems.forEach(item => {
  item.service_periods?.forEach((period: string) => servicePeriodsFound.add(period))
})

console.log(`Found ${servicePeriodsFound.size} unique service periods:`)
Array.from(servicePeriodsFound).forEach(period => {
  const count = normalizedItems.filter(item => 
    item.service_periods?.includes(period)
  ).length
  console.log(`   - ${period}: ${count} items`)
})

if (servicePeriodsFound.size === 0) {
  console.log('⚠️  WARNING: No service periods mapped')
  console.log('   This may indicate missing menuPeriods in extraction')
}

// Test 6: Category type classification
console.log('')
console.log('TEST 6: Category Type Classification')
console.log('-'['repeat'](70))

const categoryTypes = new Map<string, number>()
normalizedItems.forEach(item => {
  const count = categoryTypes.get(item.category_type) || 0
  categoryTypes.set(item.category_type, count + 1)
})

console.log(`Found ${categoryTypes.size} category types:`)
categoryTypes.forEach((count, type) => {
  console.log(`   - ${type}: ${count} items`)
})

const hasMain = categoryTypes.has('main')
console.log(hasMain ? '✅ PASS: Main category items found' : '⚠️  No main category items')

// Test 7: Layer 1 Query Simulation
console.log('')
console.log('TEST 7: Layer 1 Programme Detection Query')
console.log('-'['repeat'](70))

const { data: layer1Data } = await supabase
  .from('menu_items_normalized')
  .select('service_periods, service_period_name, menu_title')
  .eq('business_id', testBusinessId)

console.log(`Layer 1 would receive ${layer1Data?.length || 0} rows`)

const uniquePeriods = new Set<string>()
const uniqueTitles = new Set<string>()

layer1Data?.forEach(row => {
  row.service_periods?.forEach((p: string) => uniquePeriods.add(p))
  if (row.menu_title) uniqueTitles.add(row.menu_title)
})

console.log(`Unique service periods: ${Array.from(uniquePeriods).join(', ') || 'none'}`)
console.log(`Unique menu titles: ${Array.from(uniqueTitles).join(', ') || 'none'}`)

if (uniquePeriods.size > 0) {
  console.log('✅ PASS: Layer 1 can detect programmes from normalized data')
} else {
  console.log('⚠️  WARNING: No service periods available for programme detection')
}

// Test 8: Performance check
console.log('')
console.log('TEST 8: Performance Metrics')
console.log('-'['repeat'](70))

const { data: stats } = await supabase
  .from('menu_normalization_stats')
  .select('*')
  .eq('business_id', testBusinessId)
  .single()

if (stats) {
  console.log(`Total menus: ${stats.total_menus}`)
  console.log(`Completed menus: ${stats.completed_menus}`)
  console.log(`Normalized menus: ${stats.normalized_menus}`)
  console.log(`Total normalized items: ${stats.total_normalized_items}`)
  console.log(`Avg items per menu: ${stats.avg_items_per_menu}`)
  console.log(`Last sync: ${stats.last_sync}`)
  
  const coverage = stats.completed_menus > 0 
    ? (stats.normalized_menus / stats.completed_menus * 100).toFixed(1)
    : 0
  
  console.log(`Normalization coverage: ${coverage}%`)
  
  if (parseFloat(String(coverage)) >= 99) {
    console.log('✅ PASS: Excellent normalization coverage')
  } else if (parseFloat(String(coverage)) >= 90) {
    console.log('⚠️  WARNING: Good coverage but some menus missing')
  } else {
    console.log('❌ FAIL: Low normalization coverage')
  }
}

// Final summary
console.log('')
console.log('='['repeat'](70))
console.log('  TEST SUMMARY')
console.log('='['repeat'](70))
console.log('')

const testResults = [
  { name: 'Normalized items exist', pass: normalizedItems.length > 0 },
  { name: 'Service periods mapped', pass: servicePeriodsFound.size > 0 },
  { name: 'Category types classified', pass: categoryTypes.size > 0 },
  { name: 'Layer 1 can query data', pass: (layer1Data?.length || 0) > 0 },
]

let passCount = 0
testResults.forEach(result => {
  const status = result.pass ? '✅ PASS' : '❌ FAIL'
  console.log(`${status}: ${result.name}`)
  if (result.pass) passCount++
})

console.log('')
console.log(`Overall: ${passCount}/${testResults.length} tests passed`)

if (passCount === testResults.length) {
  console.log('')
  console.log('🎉 SUCCESS: Menu normalization is working correctly!')
  console.log('   Layer 1 programme detection can now access menu data')
  Deno.exit(0)
} else {
  console.log('')
  console.log('⚠️  PARTIAL SUCCESS: Some tests failed')
  console.log('   Review warnings above and investigate failures')
  Deno.exit(1)
}
