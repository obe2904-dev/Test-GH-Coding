/**
 * DATA AUDIT: Café Faust Menu Extraction & Normalization
 * 
 * Following AI-ANALYSIS-PRINCIPLES.md:
 * Step 1: Query actual data FIRST before analyzing code
 * 
 * Purpose: See what we HAVE vs what we USE
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('VITE_SUPABASE_ANON_KEY')!
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('═'.repeat(100))
console.log('CAFÉ FAUST - MENU DATA AUDIT')
console.log('═'.repeat(100))

// ============================================================================
// STEP 1: What did GPT-4o extract? (Source data)
// ============================================================================

console.log('\n📥 STEP 1: MENU EXTRACTION RESULTS (menu_results_v2)')
console.log('─'.repeat(100))

const { data: menuResults, error: menuError } = await supabase
  .from('menu_results_v2')
  .select('id, source_url, service_periods, service_period_name, structured_data, status, completed_at')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('status', 'done')
  .order('completed_at', { ascending: false })

if (menuError) {
  console.error('❌ Error fetching menu results:', menuError)
  Deno.exit(1)
}

console.log(`\nFound ${menuResults?.length || 0} completed menu extractions\n`)

menuResults?.forEach((menu, i) => {
  console.log(`\n${i + 1}. MENU EXTRACTION`)
  console.log('   ─'.repeat(48))
  console.log(`   Source URL: ${menu.source_url}`)
  console.log(`   Completed:  ${menu.completed_at}`)
  console.log(`   Service Period Name: ${menu.service_period_name || '(null)'}`)
  console.log(`   Service Periods Array: ${JSON.stringify(menu.service_periods)}`)
  
  // Check structured_data fields
  if (menu.structured_data) {
    console.log('\n   📋 Structured Data Fields:')
    const data = menu.structured_data as any
    
    console.log(`      menuTitle: ${data.menuTitle || '(not set)'}`)
    console.log(`      menuPeriods: ${JSON.stringify(data.menuPeriods || null)}`)
    console.log(`      timeWindow: ${JSON.stringify(data.timeWindow || null)}`)
    console.log(`      serviceHours: ${JSON.stringify(data.serviceHours || null)}`)
    console.log(`      categories: ${data.categories?.length || 0} categories`)
    
    // Show all top-level keys
    const allKeys = Object.keys(data)
    console.log(`\n      All JSONB keys: ${allKeys.join(', ')}`)
    
    // Show category names if they exist
    if (data.categories && data.categories.length > 0) {
      console.log(`\n      Category names:`)
      data.categories.forEach((cat: any, idx: number) => {
        const itemCount = cat.items?.length || 0
        console.log(`        ${idx + 1}. ${cat.name} (${itemCount} items)`)
      })
    }
  } else {
    console.log('   ⚠️  No structured_data')
  }
})

// ============================================================================
// STEP 2: What did normalization produce? (Processed data)
// ============================================================================

console.log('\n\n📤 STEP 2: NORMALIZATION OUTPUT (menu_items_normalized)')
console.log('─'.repeat(100))

const { data: normalizedItems, error: normError } = await supabase
  .from('menu_items_normalized')
  .select('menu_title, service_periods, category_name, menu_url')
  .eq('business_id', CAFE_FAUST_ID)

if (normError) {
  console.error('❌ Error fetching normalized items:', normError)
  Deno.exit(1)
}

console.log(`\nTotal normalized items: ${normalizedItems?.length || 0}`)

// Group by menu_title and service_periods
const groupedByMenu = new Map<string, Map<string, number>>()

normalizedItems?.forEach(item => {
  const menuTitle = item.menu_title || '[NO TITLE]'
  const servicePeriods = JSON.stringify(item.service_periods || [])
  
  if (!groupedByMenu.has(menuTitle)) {
    groupedByMenu.set(menuTitle, new Map())
  }
  
  const periodMap = groupedByMenu.get(menuTitle)!
  periodMap.set(servicePeriods, (periodMap.get(servicePeriods) || 0) + 1)
})

console.log('\n📊 Distribution by menu_title and service_periods:')
groupedByMenu.forEach((periodMap, menuTitle) => {
  console.log(`\n   Menu: "${menuTitle}"`)
  periodMap.forEach((count, periods) => {
    console.log(`      service_periods: ${periods} → ${count} items`)
  })
})

// ============================================================================
// STEP 3: URL Analysis (Unused evidence)
// ============================================================================

console.log('\n\n🔗 STEP 3: URL PATH ANALYSIS')
console.log('─'.repeat(100))

const urls = menuResults?.map(m => m.source_url) || []
console.log('\nMenu URLs extracted:')
urls.forEach((url, i) => {
  console.log(`   ${i + 1}. ${url}`)
  
  // Extract path segments that might indicate service period
  const pathMatch = url.match(/\/([^\/]+)\/?$/)
  if (pathMatch) {
    const lastSegment = pathMatch[1]
    console.log(`      → Last path segment: "${lastSegment}"`)
    
    // Check if it matches service period keywords
    const keywords = ['morgenmad', 'brunch', 'frokost', 'lunch', 'aften', 'dinner', 'bar', 'cocktail']
    const matches = keywords.filter(kw => lastSegment.toLowerCase().includes(kw))
    if (matches.length > 0) {
      console.log(`      ✅ Contains keywords: ${matches.join(', ')}`)
    } else {
      console.log(`      ⚠️  No service period keywords in URL`)
    }
  }
})

// ============================================================================
// STEP 4: Gap Analysis
// ============================================================================

console.log('\n\n🔍 STEP 4: GAP ANALYSIS (What we HAVE vs what we USE)')
console.log('─'.repeat(100))

console.log('\n✅ EXTRACTION SUCCESS:')
console.log(`   - Extracted ${menuResults?.length || 0} menus`)
console.log(`   - All have menu titles: ${menuResults?.every(m => (m.structured_data as any)?.menuTitle) ? 'YES' : 'NO'}`)
console.log(`   - All have categories: ${menuResults?.every(m => (m.structured_data as any)?.categories?.length > 0) ? 'YES' : 'NO'}`)
console.log(`   - URLs contain service keywords: ${urls.some(u => /morgenmad|brunch|frokost|aften|bar/.test(u)) ? 'YES' : 'NO'}`)

console.log('\n⚠️  POTENTIAL GAPS:')

// Check if menuPeriods is populated
const hasmenuPeriods = menuResults?.some(m => (m.structured_data as any)?.menuPeriods)
console.log(`   - menuPeriods field populated: ${hasmenuPeriods ? 'YES' : 'NO (might be under different field name)'}`)

// Check if timeWindow is populated
const hasTimeWindow = menuResults?.some(m => (m.structured_data as any)?.timeWindow)
console.log(`   - timeWindow field populated: ${hasTimeWindow ? 'YES' : 'NO'}`)

// Check if service_periods parent field is used
const hasParentServicePeriods = menuResults?.some(m => m.service_periods && m.service_periods.length > 0)
console.log(`   - Parent service_periods used: ${hasParentServicePeriods ? 'YES' : 'NO'}`)

// Check normalization coverage
const emptyServicePeriods = normalizedItems?.filter(item => !item.service_periods || item.service_periods.length === 0) || []
const coveragePercent = normalizedItems?.length ? Math.round((1 - emptyServicePeriods.length / normalizedItems.length) * 100) : 0
console.log(`   - Items with empty service_periods: ${emptyServicePeriods.length}/${normalizedItems?.length} (${100 - coveragePercent}%)`)

console.log('\n\n═'.repeat(100))
console.log('AUDIT COMPLETE - Review findings above')
console.log('═'.repeat(100))
