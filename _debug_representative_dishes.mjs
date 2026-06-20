import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log(`\n════════════════════════════════════════════════════`)
console.log(`DEBUGGING MENU EXAMPLES FOR CAFÉ FAUST`)
console.log(`════════════════════════════════════════════════════\n`)

// 1. Check brand profile
console.log(`[1/3] Checking brand profile...`)
const { data: profiles, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .eq('business_id', businessId)

if (profileError || !profiles || profiles.length === 0) {
  console.error(`  ❌ Cannot find brand profile:`, profileError)
  Deno.exit(1)
}

const profile = profiles[0]
const examples = profile.brand_profile_v5?.voice?.menu_description_examples

console.log(`  ✓ Brand profile found`)
console.log(`  menu_description_examples: ${examples ? `✅ ${examples.length} examples` : '❌ NULL/EMPTY'}\n`)

if (examples && examples.length > 0) {
  console.log(`  Examples:`)
  examples.forEach((ex, i) => console.log(`    ${i+1}. ${ex}`))
  console.log(`\n  ✓ Menu examples exist - UI should show them!\n`)
  Deno.exit(0)
}

console.log(`  ⚠️  NO MENU EXAMPLES - investigating why...\n`)

// 2. Check menus
console.log(`[2/3] Checking menus...`)
const { data: menus, error: menuError } = await supabase
  .from('menus')
  .select('id, menu_type')
  .eq('business_id', businessId)

if (!menus || menus.length === 0) {
  console.log(`  ❌ NO MENUS found - cannot generate examples without menus!`)
  Deno.exit(1)
}

console.log(`  ✓ Found ${menus.length} menus:`)
menus.forEach(m => console.log(`    - ${m.menu_type} (${m.id})`))

// 3. Check menu_results_v2 for representative_dishes
console.log(`\n[3/3] Checking representative_dishes in menu_results_v2...`)
const { data: results, error: resultsError } = await supabase
  .from('menu_results_v2')
  .select('menu_id, language_code, representative_dishes')
  .in('menu_id', menus.map(m => m.id))

if (!results || results.length === 0) {
  console.log(`  ❌ NO menu_results_v2 records - menus haven't been analyzed yet!`)
  console.log(`\n  SOLUTION: Run menu analysis first, then regenerate brand profile.`)
  Deno.exit(1)
}

console.log(`  Found ${results.length} menu results:`)
results.forEach(r => {
  const dishCount = r.representative_dishes ? r.representative_dishes.length : 0
  console.log(`    - menu: ${r.menu_id}, lang: ${r.language_code}, dishes: ${dishCount}`)
  if (dishCount === 0) {
    console.log(`      ⚠️  No representative_dishes!`)
  } else {
    console.log(`      Dishes: ${r.representative_dishes.map(d => d.name).join(', ')}`)
  }
})

const danishMenus = results.filter(r => r.language_code === 'da')
const totalDishes = danishMenus.reduce((sum, r) => sum + (r.representative_dishes?.length || 0), 0)

console.log(`\n════════════════════════════════════════════════════`)
console.log(`DIAGNOSIS:`)
console.log(`════════════════════════════════════════════════════`)
console.log(`  Danish menus: ${danishMenus.length}`)
console.log(`  Total representative_dishes in Danish menus: ${totalDishes}`)

if (totalDishes === 0) {
  console.log(`\n  ❌ PROBLEM: No representative_dishes in Danish menus!`)
  console.log(`\n  SOLUTION:`)
  console.log(`    1. Check if menus need to be re-analyzed`)
  console.log(`    2. Run menu extraction/analysis to populate representative_dishes`)
  console.log(`    3. Then regenerate brand profile`)
} else {
  console.log(`\n  ⚠️  UNEXPECTED: We have ${totalDishes} representative dishes but brand profile has no examples!`)
  console.log(`     This suggests the brand-profile-generator-v5 function might have failed silently.`)
  console.log(`     Check Supabase logs or try regenerating again.`)
}

console.log(`\n`)
