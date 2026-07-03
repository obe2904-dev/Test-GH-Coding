import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const language = 'da'

console.log(`\n══════════════════════════════════════════════`)
console.log(`TESTING FIXED QUERY LOGIC`)
console.log(`══════════════════════════════════════════════\n`)

// Step 1: Get menu IDs (this is what the fix does)
console.log(`[1/2] Getting menu IDs for business...`)
const { data: menus, error: menuIdError } = await supabase
  .from('menus')
  .select('id, menu_type')
  .eq('business_id', businessId)

if (menuIdError) {
  console.log(`  ❌ Error: ${menuIdError.message}`)
  Deno.exit(1)
}

console.log(`  ✅ Found ${menus?.length || 0} menu(s)`)
menus?.forEach(m => console.log(`     - ${m.menu_type} (${m.id})`))

const menuIds = menus?.map(m => m.id) || []

if (menuIds.length === 0) {
  console.log(`\n  ❌ No menus found - cannot proceed`)
  Deno.exit(1)
}

// Step 2: Query menu_results_v2 by menu_id (NOT business_id)
console.log(`\n[2/2] Getting representative dishes from menu_results_v2...`)
console.log(`  Filtering: menu_id IN [${menuIds.join(', ')}], language=${language}, status=done`)

const { data: menuResults, error: menuQueryError } = await supabase
  .from('menu_results_v2')
  .select('representative_dishes, language_code, service_period_name, menu_id')
  .in('menu_id', menuIds)
  .eq('language_code', language)
  .eq('status', 'done')
  .not('representative_dishes', 'is', null)
  .order('completed_at', { ascending: false })

if (menuQueryError) {
  console.log(`  ❌ Error: ${menuQueryError.message}`)
  Deno.exit(1)
}

console.log(`  ✅ Found ${menuResults?.length || 0} menu result(s) with Danish dishes\n`)

if (menuResults && menuResults.length > 0) {
  const allDishes = menuResults.flatMap(r => {
    const dishes = r.representative_dishes?.dishes || []
    console.log(`     ${r.service_period_name || 'NO NAME'}: ${dishes.length} dishes`)
    return dishes
  })
  
  const sample = allDishes.slice(0, 3)
  console.log(`\n  🍽️  Sample for voice examples (first 3):`)
  sample.forEach((d, i) => {
    console.log(`     ${i+1}. ${d.name} (${d.price} ${d.currency})`)
  })
  
  console.log(`\n  ✅ SUCCESS! Query now finds ${allDishes.length} Danish dishes`)
  console.log(`     These will be used to generate 6 menu description examples (2 per dish)`)
} else {
  console.log(`\n  ❌ STILL NO RESULTS`)
  console.log(`     This means the data doesn't exist or status/language don't match`)
}

console.log('\n')
