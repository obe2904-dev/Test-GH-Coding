#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

// Get ALL menu items to check for sustainability evidence
const { data: menuItems, error } = await supabase
  .from('menu_items_normalized')
  .select('item_name, item_description')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .eq('is_active', true)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('MENU EVIDENCE ANALYSIS')
console.log('═══════════════════════════════════════════════════════════════\n')

console.log(`Total menu items: ${menuItems?.length || 0}\n`)

// Check for Danish items (evidence for "lokale råvarer")
const danishKeywords = ['dansk', 'hjemmelavet', 'hjemmelavede', 'frisk', 'friske', 'friskbagt']
const danishItems = menuItems?.filter(item => {
  const text = `${item.item_name} ${item.item_description || ''}`.toLowerCase()
  return danishKeywords.some(kw => text.includes(kw))
}) || []

console.log('--- 🇩🇰 Danish/Local Items (evidence for "lokale råvarer") ---')
if (danishItems.length > 0) {
  danishItems.forEach(item => {
    console.log(`✅ ${item.item_name}`)
    if (item.item_description) {
      const text = `${item.item_name} ${item.item_description}`.toLowerCase()
      const found = danishKeywords.filter(kw => text.includes(kw))
      console.log(`   Keywords: ${found.join(', ')}`)
      console.log(`   → ${item.item_description.substring(0, 100)}...`)
    }
  })
} else {
  console.log('❌ No Danish/local items found')
}
console.log(`\nTotal: ${danishItems.length} items`)

// Check for seasonal items
const seasonalKeywords = ['sæson', 'seasonal', 'forår', 'sommer', 'efterår', 'vinter']
const seasonalItems = menuItems?.filter(item => {
  const text = `${item.item_name} ${item.item_description || ''}`.toLowerCase()
  return seasonalKeywords.some(kw => text.includes(kw))
}) || []

console.log('\n--- 🍂 Seasonal Items (evidence for "sæsonbetonede ingredienser") ---')
if (seasonalItems.length > 0) {
  seasonalItems.forEach(item => {
    console.log(`✅ ${item.item_name}`)
    if (item.item_description) {
      console.log(`   → ${item.item_description.substring(0, 100)}...`)
    }
  })
} else {
  console.log('❌ No seasonal items found')
}
console.log(`\nTotal: ${seasonalItems.length} items`)

// Check for organic/sustainability keywords
const sustainabilityKeywords = ['økologisk', 'organic', 'bæredygtig', 'sustainable', 'lokal', 'local']
const sustainableItems = menuItems?.filter(item => {
  const text = `${item.item_name} ${item.item_description || ''}`.toLowerCase()
  return sustainabilityKeywords.some(kw => text.includes(kw))
}) || []

console.log('\n--- 🌱 Organic/Sustainable Items ---')
if (sustainableItems.length > 0) {
  sustainableItems.forEach(item => {
    console.log(`✅ ${item.item_name}`)
    if (item.item_description) {
      console.log(`   → ${item.item_description.substring(0, 100)}...`)
    }
  })
} else {
  console.log('❌ No organic/sustainable items found')
}
console.log(`\nTotal: ${sustainableItems.length} items`)

console.log('\n--- 🎯 VERDICT ---')
console.log(`\n"Lokale råvarer": ${danishItems.length > 0 ? `✅ JUSTIFIED (${danishItems.length} items)` : '❌ NOT SUPPORTED'}`)
console.log(`"Sæsonbetonede ingredienser": ${seasonalItems.length > 0 ? `✅ JUSTIFIED (${seasonalItems.length} items)` : '⚠️  WEAK (generic claim)'}`)
console.log(`"Bæredygtighed": ${sustainableItems.length > 0 ? `✅ SUPPORTED (${sustainableItems.length} items)` : '❌ NOT SUPPORTED'}`)

console.log('\n═══════════════════════════════════════════════════════════════\n')
