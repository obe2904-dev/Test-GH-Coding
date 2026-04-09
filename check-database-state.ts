/**
 * Check what data actually exists in the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Load .env file manually
const envFile = await Deno.readTextFile('.env');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length) {
      env[key] = values.join('=');
    }
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('🔍 Checking database state\n')

// Check businesses
console.log('1️⃣ Checking businesses table...')
const { data: businesses, error: bizError, count: bizCount } = await supabase
  .from('businesses')
  .select('*', { count: 'exact' })
  .limit(5)

if (bizError) {
  console.error('   ❌ Error:', bizError.message)
} else {
  console.log(`   ✓ Found ${bizCount} businesses`)
  if (businesses && businesses.length > 0) {
    businesses.forEach(b => console.log(`     • ${b.id} - ${b.name || 'No name'}`))
  }
}

// Check menu_results_v2
console.log('\n2️⃣ Checking menu_results_v2 table...')
const { data: menus, error: menuError, count: menuCount } = await supabase
  .from('menu_results_v2')
  .select('*', { count: 'exact' })
  .limit(5)

if (menuError) {
  console.error('   ❌ Error:', menuError.message)
} else {
  console.log(`   ✓ Found ${menuCount} menu records`)
  if (menus && menus.length > 0) {
    menus.forEach(m => console.log(`     • ${m.business_id} - ${m.status}`))
  }
}

// Check menu_item_metadata (our test table)
console.log('\n3️⃣ Checking menu_item_metadata table (our Layer 5 table)...')
const { data: menuItems, error: itemError, count: itemCount } = await supabase
  .from('menu_item_metadata')
  .select('*', { count: 'exact' })
  .limit(10)

if (itemError) {
  console.error('   ❌ Error:', itemError.message)
} else {
  console.log(`   ✓ Found ${itemCount} menu items`)
  if (menuItems && menuItems.length > 0) {
    console.log('\n📋 Menu items in database:')
    menuItems.forEach((item, i) => {
      console.log(`\n   ${i + 1}. ${item.item_name}`)
      console.log(`      Business: ${item.business_id}`)
      console.log(`      Category: ${item.item_category}`)
      console.log(`      Flags: ${item.is_signature ? 'Signature' : ''}${item.is_seasonal ? ' Seasonal' : ''}${item.is_lto ? ' LTO' : ''}`)
      if (item.seasonal_ingredients) {
        console.log(`      Ingredients: ${item.seasonal_ingredients.join(', ')}`)
      }
      console.log(`      Posted: ${item.times_posted_total} times`)
      if (item.last_posted_date) {
        console.log(`      Last post: ${item.last_posted_date}`)
      }
    })
  }
}

console.log('\n✅ Database state check complete')
console.log('\n📝 SUMMARY:')
console.log(`   • Businesses: ${bizCount || 0}`)
console.log(`   • Menu results (parsed menus): ${menuCount || 0}`)
console.log(`   • Menu item metadata (Layer 5): ${itemCount || 0}`)
console.log('\n💡 NOTE: The test data we populated is in menu_item_metadata,')
console.log('   which is separate from the actual menu parsing system.')
console.log('   For production, we need to either:')
console.log('   1. Parse existing menus and populate menu_item_metadata, OR')
console.log('   2. Let users manually tag their menu items in the UI')
