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

const { data } = await supabase
  .from('weekly_strategies')
  .select('content_plan')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('generated_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (data && data.content_plan && data.content_plan.content_slots) {
  console.log('📊 Content Slots - timing_window values:\n')
  data.content_plan.content_slots.forEach((slot, idx) => {
    console.log(`Slot ${slot.slot_id || idx + 1}:`)
    console.log(`  timing_window: "${slot.timing_window}"`)
    console.log(`  suggested_day: ${slot.suggested_day}`)
    console.log('')
  })
} else {
  console.log('No content plan found')
}
