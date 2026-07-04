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

const weekStart = '2026-06-08'

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('post_ideas, status, generated_at')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .eq('week_start', weekStart)
  .maybeSingle()

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (!data) {
  console.log('❌ No strategy found for week', weekStart)
  process.exit(1)
}

console.log('📊 Strategy for week', weekStart)
console.log('   Status:', data.status)
console.log('   Generated:', data.generated_at)
console.log()

if (!data.post_ideas || data.post_ideas.length === 0) {
  console.log('❌ No post ideas in strategy')
  process.exit(1)
}

console.log('📝 Service Period Check:\n')
let hasServicePeriod = false
data.post_ideas.forEach((idea, idx) => {
  const sp = idea.service_period
  console.log(`${idx + 1}. ${idea.title}`)
  console.log(`   Time: ${idea.suggested_time}`)
  console.log(`   Service Period: ${sp ? `✅ ${sp}` : '❌ NOT SET'}`)
  console.log()
  if (sp) hasServicePeriod = true
})

if (hasServicePeriod) {
  console.log('🎉 SUCCESS: service_period is being tracked!')
} else {
  console.log('❌ FAIL: service_period not set')
}
