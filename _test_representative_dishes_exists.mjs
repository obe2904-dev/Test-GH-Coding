import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log(`\n══════════════════════════════════════════════`)
console.log(`CHECKING IF REPRESENTATIVE_DISHES EXISTS`)
console.log(`══════════════════════════════════════════════\n`)

// Check if menu_results_v2 has ANY records for this business
console.log(`[1] Checking for ANY menu_results_v2 records...`)
const { data: anyRecords, error: anyError } = await supabase
  .from('menu_results_v2')
  .select('id, business_id, language_code, status, service_period_name')
  .eq('business_id', businessId)
  .limit(5)

console.log(`  Found: ${anyRecords?.length || 0} total records`)
if (anyRecords && anyRecords.length > 0) {
  anyRecords.forEach(r => {
    console.log(`    - ${r.service_period_name || 'NO NAME'}: lang=${r.language_code}, status=${r.status}`)
  })
}

// Now try to select representative_dishes column
console.log(`\n[2] Trying to SELECT representative_dishes column...`)
try {
  const { data, error } = await supabase
    .from('menu_results_v2')
    .select('id, representative_dishes')
    .eq('business_id', businessId)
    .limit(1)
  
  if (error) {
    console.log(`  ❌ ERROR: ${error.message}`)
    console.log(`  \n  → This means the representative_dishes column doesn't exist yet!`)
    console.log(`    You need to run the migration: ADD_REPRESENTATIVE_DISHES_COLUMN.sql`)
  } else {
    console.log(`  ✅ Column exists`)
    if (data && data.length > 0) {
      const hasData = data[0].representative_dishes !== null
      console.log(`     Has data: ${hasData ? 'YES' : 'NO (NULL)'}`)
      if (hasData) {
        console.log(`     Sample:`, JSON.stringify(data[0].representative_dishes, null, 2).substring(0, 200))
      } else {
        console.log(`\n  → The column exists but is NULL/empty`)
        console.log(`    You need to populate it (run menu analysis)`)
      }
    }
  }
} catch (e) {
  console.log(`  ❌ EXCEPTION: ${e.message}`)
}

console.log('\n')
