/**
 * Investigate actual menu data in the database
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
const TEST_BUSINESS_ID = '840347de-9ba7-4275-8aa3-4553417fc2af'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('🔍 Investigating actual menu data in database\n')

// 1. Check if business has menu data
console.log('1️⃣ Checking menu_results_v2 for business...')
const { data: menuResults, error: menuError } = await supabase
  .from('menu_results_v2')
  .select('id, business_id, source_url, status, created_at')
  .eq('business_id', TEST_BUSINESS_ID)
  .limit(5)

if (menuError) {
  console.error('   ❌ Error:', menuError.message)
} else if (!menuResults || menuResults.length === 0) {
  console.log('   ⚠️  No menu data found for this business')
  
  // Try finding ANY business with menu data
  console.log('\n2️⃣ Looking for ANY businesses with menu data...')
  const { data: anyMenus, error: anyError } = await supabase
    .from('menu_results_v2')
    .select('business_id, status')
    .limit(10)
  
  if (anyError) {
    console.error('   ❌ Error:', anyError.message)
  } else if (anyMenus && anyMenus.length > 0) {
    console.log(`   ✓ Found ${anyMenus.length} menu records:`)
    anyMenus.forEach(m => console.log(`     • ${m.business_id} (${m.status})`))
    
    // Get structured data from first menu
    const firstBusinessId = anyMenus[0].business_id
    console.log(`\n3️⃣ Fetching structured menu data for ${firstBusinessId}...`)
    
    const { data: structuredMenu, error: structuredError } = await supabase
      .from('menu_results_v2')
      .select('structured_data')
      .eq('business_id', firstBusinessId)
      .not('structured_data', 'is', null)
      .limit(1)
      .single()
    
    if (structuredError) {
      console.error('   ❌ Error:', structuredError.message)
    } else if (structuredMenu?.structured_data) {
      const menuData = structuredMenu.structured_data as any
      
      console.log('\n📋 ACTUAL MENU STRUCTURE:')
      console.log(JSON.stringify(menuData, null, 2).slice(0, 2000) + '...')
      
      if (menuData.menu?.sections) {
        console.log('\n📊 MENU SECTIONS:')
        menuData.menu.sections.forEach((section: any, idx: number) => {
          console.log(`\n   Section ${idx + 1}: ${section.name}`)
          if (section.items && section.items.length > 0) {
            console.log(`   Items (${section.items.length} total):`)
            section.items.slice(0, 5).forEach((item: any) => {
              console.log(`     • ${item.name}${item.price ? ` - ${item.price}` : ''}`)
              if (item.description) {
                console.log(`       ${item.description.slice(0, 80)}...`)
              }
            })
            if (section.items.length > 5) {
              console.log(`     ... and ${section.items.length - 5} more items`)
            }
          }
        })
      }
    } else {
      console.log('   ⚠️  No structured_data found')
    }
  } else {
    console.log('   ⚠️  No menu data in database at all')
  }
} else {
  console.log(`   ✓ Found ${menuResults.length} menu records`)
  menuResults.forEach(m => console.log(`     • ${m.id} (${m.status}) - ${m.source_url || 'no url'}`))
  
  // Get structured data
  console.log('\n2️⃣ Fetching structured menu data...')
  const { data: structuredMenu, error: structuredError } = await supabase
    .from('menu_results_v2')
    .select('structured_data')
    .eq('business_id', TEST_BUSINESS_ID)
    .not('structured_data', 'is', null)
    .limit(1)
    .single()
  
  if (structuredError) {
    console.error('   ❌ Error:', structuredError.message)
  } else if (structuredMenu?.structured_data) {
    const menuData = structuredMenu.structured_data as any
    
    console.log('\n📋 ACTUAL MENU STRUCTURE:')
    console.log(JSON.stringify(menuData, null, 2).slice(0, 2000) + '...')
    
    if (menuData.menu?.sections) {
      console.log('\n📊 MENU SECTIONS:')
      menuData.menu.sections.forEach((section: any, idx: number) => {
        console.log(`\n   Section ${idx + 1}: ${section.name}`)
        if (section.items && section.items.length > 0) {
          console.log(`   Items (${section.items.length} total):`)
          section.items.slice(0, 5).forEach((item: any) => {
            console.log(`     • ${item.name}${item.price ? ` - ${item.price}` : ''}`)
            if (item.description) {
              console.log(`       ${item.description.slice(0, 80)}...`)
            }
          })
          if (section.items.length > 5) {
            console.log(`     ... and ${section.items.length - 5} more items`)
          }
        }
      })
    }
  } else {
    console.log('   ⚠️  No structured_data found')
  }
}

console.log('\n✅ Investigation complete')
