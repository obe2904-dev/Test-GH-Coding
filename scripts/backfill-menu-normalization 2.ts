/**
 * Backfill Menu Normalization - Step 5 Implementation
 * 
 * Processes all existing menu_results_v2 rows with status='done'
 * and normalizes them into menu_items_normalized table.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/backfill-menu-normalization.ts
 * 
 * @date May 7, 2026
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('='['repeat'](60))
console.log('  MENU NORMALIZATION BACKFILL')
console.log('='['repeat'](60))
console.log('')

// Step 1: Check current state
console.log('📊 Checking current state...')

const { data: extractedMenus, error: extractedError } = await supabase
  .from('menu_results_v2')
  .select('id, business_id, source_url, completed_at')
  .eq('status', 'done')
  .not('structured_data', 'is', null)
  .order('completed_at', { ascending: false })

if (extractedError) {
  console.error('❌ Error fetching extracted menus:', extractedError)
  Deno.exit(1)
}

console.log(`   Found ${extractedMenus?.length || 0} extracted menus`)

const { count: normalizedCount, error: countError } = await supabase
  .from('menu_items_normalized')
  .select('*', { count: 'exact', head: true })

if (countError) {
  console.error('❌ Error counting normalized items:', countError)
  Deno.exit(1)
}

console.log(`   Currently ${normalizedCount || 0} normalized items in database`)
console.log('')

// Step 2: Analyze what needs normalization
const needsNormalization = []
const alreadyNormalized = []

for (const menu of extractedMenus || []) {
  const { count } = await supabase
    .from('menu_items_normalized')
    .select('*', { count: 'exact', head: true })
    .eq('menu_result_id', menu.id)
  
  if (count === 0) {
    needsNormalization.push(menu)
  } else {
    alreadyNormalized.push(menu)
  }
}

console.log('📋 Normalization Analysis:')
console.log(`   ✅ Already normalized: ${alreadyNormalized.length} menus`)
console.log(`   ⏳ Needs normalization: ${needsNormalization.length} menus`)
console.log('')

if (needsNormalization.length === 0) {
  console.log('✨ All menus are already normalized!')
  Deno.exit(0)
}

// Step 3: Confirm with user
console.log('🚀 Ready to normalize menus:')
needsNormalization.slice(0, 5).forEach(menu => {
  console.log(`   - ${menu.source_url} (${menu.business_id})`)
})
if (needsNormalization.length > 5) {
  console.log(`   ... and ${needsNormalization.length - 5} more`)
}
console.log('')

// Auto-proceed (remove this in production to require confirmation)
console.log('⚙️  Starting normalization...')
console.log('')

// Step 4: Process each menu
let successCount = 0
let errorCount = 0
const errors: Array<{ menuId: string; error: string }> = []

for (let i = 0; i < needsNormalization.length; i++) {
  const menu = needsNormalization[i]
  const progress = `[${i + 1}/${needsNormalization.length}]`
  
  try {
    // Trigger normalization by updating the row
    // This will fire the database trigger which calls sync_menu_items_to_normalized()
    const { error: updateError } = await supabase
      .from('menu_results_v2')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', menu.id)
    
    if (updateError) {
      throw updateError
    }
    
    // Wait a moment for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Verify normalization succeeded
    const { count: itemCount } = await supabase
      .from('menu_items_normalized')
      .select('*', { count: 'exact', head: true })
      .eq('menu_result_id', menu.id)
    
    if (itemCount && itemCount > 0) {
      console.log(`${progress} ✅ Normalized ${itemCount} items from ${menu.source_url}`)
      successCount++
    } else {
      console.log(`${progress} ⚠️  No items normalized from ${menu.source_url} (empty menu?)`)
      successCount++
    }
    
  } catch (error) {
    console.error(`${progress} ❌ Error normalizing ${menu.source_url}:`, error)
    errorCount++
    errors.push({ 
      menuId: menu.id, 
      error: error instanceof Error ? error.message : String(error) 
    })
  }
}

console.log('')
console.log('='['repeat'](60))
console.log('  BACKFILL COMPLETE')
console.log('='['repeat'](60))
console.log('')
console.log(`✅ Successfully normalized: ${successCount} menus`)
console.log(`❌ Errors: ${errorCount} menus`)
console.log('')

if (errors.length > 0) {
  console.log('Errors encountered:')
  errors.forEach(({ menuId, error }) => {
    console.log(`   - ${menuId}: ${error}`)
  })
  console.log('')
}

// Step 5: Final verification
const { count: finalCount } = await supabase
  .from('menu_items_normalized')
  .select('*', { count: 'exact', head: true })

console.log(`📊 Final Stats:`)
console.log(`   Total normalized items in database: ${finalCount || 0}`)
console.log(`   Started with: ${normalizedCount || 0}`)
console.log(`   Added: ${(finalCount || 0) - (normalizedCount || 0)}`)
console.log('')

// Step 6: Show sample data
console.log('📝 Sample normalized items:')
const { data: sampleItems } = await supabase
  .from('menu_items_normalized')
  .select('business_id, item_name, category_name, service_periods, menu_title')
  .limit(5)

sampleItems?.forEach(item => {
  console.log(`   - ${item.item_name} (${item.category_name})`)
  console.log(`     Service periods: ${item.service_periods?.join(', ') || 'none'}`)
  console.log(`     Menu: ${item.menu_title || 'unknown'}`)
})

console.log('')
console.log('✨ Backfill complete!')
