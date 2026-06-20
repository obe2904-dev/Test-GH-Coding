import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = normalized.indexOf('=')
    if (eq === -1) continue
    const key = normalized.slice(0, eq).trim()
    let value = normalized.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

const env = parseDotEnv(fs.readFileSync('.env', 'utf8'))
const supabase = createClient('https://kvqdkohdpvmdylqgujpn.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase
  .from('menu_results_v2')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .limit(1)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (data.length > 0) {
  console.log('📊 Available columns:', Object.keys(data[0]).join(', '))
  console.log()
}

// Now get all menus with correct columns
const { data: menus, error: error2 } = await supabase
  .from('menu_results_v2')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')

if (error2) {
  console.error('❌ Error:', error2.message)
  process.exit(1)
}

console.log('📋 MENU TIMING FACTS for Cafe Faust:\n')
console.log(`Found ${menus.length} menu(s)\n`)

for (const menu of menus) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📖 Menu ID: ${menu.id}`)
  
  if (menu.structured_data) {
    const data = menu.structured_data
    console.log(`   Title: ${data.menuTitle || 'Untitled'}`)
    console.log(`   Availability: ${data.availabilityTime || 'Not specified'}`)
    
    if (data.menuPeriods && data.menuPeriods.length > 0) {
      console.log(`   Service periods:`)
      const timings = new Map()
      for (const period of data.menuPeriods) {
        if (period.startTime && period.endTime) {
          const key = `${period.startTime} - ${period.endTime}`
          if (!timings.has(key)) {
            timings.set(key, [])
          }
          timings.get(key).push(period.name)
        }
      }
      timings.forEach((names, time) => {
        console.log(`      ${time}: ${names.join(', ')}`)
      })
    }
  }
  console.log()
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('💡 FACT-BASED INSIGHT:')
console.log('   Posts should be scheduled during these actual menu availability windows')
