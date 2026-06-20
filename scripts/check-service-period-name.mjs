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
  .select('structured_data, service_period_name')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .not('structured_data', 'is', null)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('📊 Menu service_period_name values:\n')
data.forEach((menu, i) => {
  const title = menu.structured_data?.menuTitle || 'Untitled'
  const availability = menu.structured_data?.availabilityTime || 'Not specified'
  const servicePeriodName = menu.service_period_name
  
  console.log(`${i + 1}. ${title} (${availability})`)
  console.log(`   service_period_name: ${servicePeriodName || '❌ NULL'}`)
  
  if (menu.structured_data?.menuPeriods?.[0]) {
    const period = menu.structured_data.menuPeriods[0]
    console.log(`   First period timing: ${period.startTime} - ${period.endTime}`)
  }
  console.log('')
})
