import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('VITE_SUPABASE_ANON_KEY')!
)

const businessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('='.repeat(80))
console.log('PROGRAMME DETECTION DIAGNOSTIC - CAFÉ FAUST')
console.log('='.repeat(80))

// 1. Check opening hours
console.log('\n📅 OPENING HOURS:')
console.log('-'.repeat(80))
const { data: hours } = await supabase
  .from('opening_hours')
  .select('*')
  .eq('business_id', businessId)
  .order('day_of_week')

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const sortedHours = hours?.sort((a, b) => 
  dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week)
)

sortedHours?.forEach(h => {
  console.log(`${h.day_of_week.padEnd(10)} | ${h.open_time} - ${h.close_time} | ${h.is_closed ? 'CLOSED' : 'OPEN'}`)
})

// 2. Check menu items by service_periods
console.log('\n🍽️  MENU ITEMS BY SERVICE PERIODS:')
console.log('-'.repeat(80))
const { data: menuItems } = await supabase
  .from('menu_items_normalized')
  .select('item_name, category_name, service_periods, menu_title')
  .eq('business_id', businessId)

console.log(`Total menu items: ${menuItems?.length || 0}`)

// Group by service_periods
const byServicePeriod = new Map<string, number>()
menuItems?.forEach(item => {
  const periods = item.service_periods || []
  if (periods.length === 0) {
    byServicePeriod.set('[EMPTY]', (byServicePeriod.get('[EMPTY]') || 0) + 1)
  } else {
    periods.forEach(period => {
      byServicePeriod.set(period, (byServicePeriod.get(period) || 0) + 1)
    })
  }
})

console.log('\nDistribution by service_periods:')
Array.from(byServicePeriod.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([period, count]) => {
    console.log(`  ${period.padEnd(20)} | ${count} items`)
  })

// 3. Sample items per service period
console.log('\n📋 SAMPLE ITEMS PER SERVICE PERIOD:')
console.log('-'.repeat(80))
const uniquePeriods = new Set<string>()
menuItems?.forEach(item => {
  item.service_periods?.forEach(p => uniquePeriods.add(p))
})

for (const period of Array.from(uniquePeriods).sort()) {
  const items = menuItems?.filter(m => m.service_periods?.includes(period))
  console.log(`\n${period.toUpperCase()} (${items?.length || 0} items):`)
  items?.slice(0, 5).forEach(item => {
    console.log(`  • ${item.item_name} (${item.category_name})`)
  })
  if (items && items.length > 5) {
    console.log(`  ... and ${items.length - 5} more`)
  }
}

// 4. Check menu_title distribution
console.log('\n📖 MENU TITLES:')
console.log('-'.repeat(80))
const menuTitles = new Map<string, number>()
menuItems?.forEach(item => {
  const title = item.menu_title || '[NO TITLE]'
  menuTitles.set(title, (menuTitles.get(title) || 0) + 1)
})

Array.from(menuTitles.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([title, count]) => {
    console.log(`  ${title.padEnd(30)} | ${count} items`)
  })

console.log('\n' + '='.repeat(80))
console.log('DIAGNOSTIC COMPLETE')
console.log('='.repeat(80))
