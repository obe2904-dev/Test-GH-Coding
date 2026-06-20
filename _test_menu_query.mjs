import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const language = 'da'

console.log(`\nTesting menu_results_v2 query...`)
console.log(`  business_id: ${businessId}`)
console.log(`  language_code: ${language}`)
console.log(`  status: done`)
console.log(`  representative_dishes IS NOT NULL\n`)

const { data, error } = await supabase
  .from('menu_results_v2')
  .select('representative_dishes, language_code, service_period_name, status')
  .eq('business_id', businessId)
  .eq('language_code', language)
  .eq('status', 'done')
  .not('representative_dishes', 'is', null)
  .order('completed_at', { ascending: false })

console.log(`Results:`)
console.log(`  error:`, error)
console.log(`  count:`, data?.length || 0)

if (data && data.length > 0) {
  data.forEach((r, i) => {
    const dishCount = r.representative_dishes?.dishes?.length || 0
    console.log(`\n  [${i+1}] ${r.service_period_name} (${r.language_code}, ${r.status})`)
    console.log(`      Dishes: ${dishCount}`)
    if (dishCount > 0) {
      r.representative_dishes.dishes.slice(0, 2).forEach(d => {
        console.log(`        - ${d.name}`)
      })
    }
  })
} else {
  console.log(`\n  ⚠️  NO RESULTS\n`)
  
  // Try without language filter
  console.log(`\nTrying without language filter...`)
  const { data: anyLang } = await supabase
    .from('menu_results_v2')
    .select('representative_dishes, language_code, service_period_name, status')
    .eq('business_id', businessId)
    .eq('status', 'done')
    .not('representative_dishes', 'is', null)
  
  console.log(`  Found: ${anyLang?.length || 0} results`)
  anyLang?.forEach(r => {
    console.log(`    - ${r.service_period_name}: language=${r.language_code}`)
  })
}

console.log('\n')

// Let's see ALL menu_results_v2 for this business (no filters)
console.log(`\nChecking ALL menu_results_v2 for this business...`)
const { data: allResults } = await supabase
  .from('menu_results_v2')
  .select('id, business_id, language_code, service_period_name, status, representative_dishes')
  .eq('business_id', businessId)
  .limit(10)

console.log(`  Found: ${allResults?.length || 0} total rows`)
if (allResults && allResults.length > 0) {
  allResults.forEach((r, i) => {
    const hasRepr = r.representative_dishes !== null
    const dishCount = hasRepr ? (r.representative_dishes?.dishes?.length || 0) : 0
    console.log(`\n  [${i+1}] ${r.service_period_name || 'NO NAME'}`)
    console.log(`      language_code: ${r.language_code}`)
    console.log(`      status: ${r.status}`)
    console.log(`      representative_dishes: ${hasRepr ? `YES (${dishCount} dishes)` : 'NULL'}`)
  })
} else {
  console.log(`\n  ⚠️  NO ROWS AT ALL for business_id=${businessId}`)
  console.log(`      This means the business_id column doesn't match, or no data exists.`)
}

console.log('\n')
