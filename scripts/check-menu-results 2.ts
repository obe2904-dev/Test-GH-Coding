/**
 * Check menu_results_v2 without filters
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('VITE_SUPABASE_ANON_KEY')!
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('Checking menu_results_v2 for Café Faust...\n')

// Check all statuses
const { data: allMenus, error } = await supabase
  .from('menu_results_v2')
  .select('id, source_url, status, completed_at, structured_data')
  .eq('business_id', CAFE_FAUST_ID)
  .order('completed_at', { ascending: false })

if (error) {
  console.error('Error:', error)
  Deno.exit(1)
}

console.log(`Total menu results: ${allMenus?.length || 0}\n`)

if (allMenus && allMenus.length > 0) {
  allMenus.forEach((menu, i) => {
    console.log(`${i + 1}. ${menu.source_url}`)
    console.log(`   Status: ${menu.status}`)
    console.log(`   Completed: ${menu.completed_at || 'N/A'}`)
    console.log(`   Has structured_data: ${menu.structured_data ? 'YES' : 'NO'}`)
    
    if (menu.structured_data) {
      const data = menu.structured_data as any
      console.log(`   Menu title: ${data.menuTitle || '(none)'}`)
      console.log(`   Categories: ${data.categories?.length || 0}`)
    }
    console.log()
  })
} else {
  console.log('❌ No menu results found for this business_id')
  console.log('\nChecking if business exists...')
  
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', CAFE_FAUST_ID)
    .single()
  
  if (bizError) {
    console.log(`❌ Business not found: ${bizError.message}`)
  } else {
    console.log(`✅ Business exists: ${business?.name}`)
    console.log('   But has no menu extractions in menu_results_v2')
  }
}
