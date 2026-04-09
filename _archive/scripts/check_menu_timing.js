// Quick script to check menu timing data
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env file manually
const envFile = readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
)

async function checkTiming() {
  // Check for Menukort specifically
  console.log('\n🔍 Checking Menukort data...')
  const { data, error } = await supabase
    .from('menu_results_v2')
    .select('id, source_id, source_url, status, created_at, structured_data')
    .eq('source_url', 'https://cafefaust.dk/menukort/')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (data.length === 0) {
    console.log('❌ No data found for Menukort')
    return
  }

  const result = data[0]
  console.log(`\n━━━ Menukort Result ━━━`)
  console.log(`ID: ${result.id}`)
  console.log(`Source ID: ${result.source_id}`)
  console.log(`Status: ${result.status}`)
  console.log(`Created: ${new Date(result.created_at).toLocaleString()}`)
  
  const structured = result.structured_data
  
  if (structured?.availabilityTime) {
    console.log(`\n📋 Availability Time: "${structured.availabilityTime}"`)
  } else {
    console.log(`\n⚠️ No availabilityTime found`)
  }
  
  if (structured?.menuTitle) {
    console.log(`📄 Menu Title: "${structured.menuTitle}"`)
  }
  
  if (structured?.categories) {
    console.log(`\n📊 Categories (${structured.categories.length}):`)
    structured.categories.slice(0, 3).forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.name}`)
      if (cat.timeRange) console.log(`     ⏰ timeRange: ${cat.timeRange}`)
      console.log(`     📦 ${cat.items?.length || 0} items`)
    })
  }
  
  if (structured?.menuPeriods) {
    console.log(`\n✅ menuPeriods found (${structured.menuPeriods.length}):`)
    structured.menuPeriods.forEach((period, i) => {
      console.log(`  ${i + 1}. ${period.name} (${period.type})`)
      console.log(`     ⏰ ${period.startTime}-${period.endTime}`)
      console.log(`     📦 ${period.items?.length || 0} items`)
    })
  } else {
    console.log(`\n❌ NO menuPeriods found in structured_data`)
    console.log(`\nStructured data keys:`, Object.keys(structured || {}))
  }
}

checkTiming()
