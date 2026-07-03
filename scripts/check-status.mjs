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

const nextMonday = new Date()
nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7))
const weekStart = nextMonday.toISOString().split('T')[0]

const { data } = await supabase
  .from('weekly_strategies')
  .select('status, created_at, generated_at, error_message')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .eq('week_start', weekStart)
  .maybeSingle()

if (!data) {
  console.log('❌ No strategy found for week', weekStart)
  console.log('Generation may still be in progress or failed to start')
} else {
  console.log('📊 Strategy Status:')
  console.log('   Status:', data.status)
  console.log('   Created:', data.created_at)
  console.log('   Generated:', data.generated_at || 'NOT YET')
  if (data.error_message) {
    console.log('   Error:', data.error_message)
  }
}
