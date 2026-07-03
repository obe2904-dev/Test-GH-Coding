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

const weekStart = '2026-06-15'

console.log('🔄 Generating strategy for week:', weekStart)

const res = await fetch('https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify({
    business_id: 'f4679fa9-3120-4a59-9506-d059b010c34a',
    week_start: weekStart,
    target_post_count: 4
  })
})

console.log('📊 Status:', res.status, res.statusText)

if (!res.ok) {
  console.error('❌ Failed:', await res.text())
  process.exit(1)
}

console.log('\n⏱️  Waiting 30 seconds for generation...\n')
await new Promise(resolve => setTimeout(resolve, 30000))

const { data, error } = await supabase
  .from('weekly_strategies')
  .select('post_ideas')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .eq('week_start', weekStart)
  .maybeSingle()

if (error) {
  console.error('❌ Error fetching:', error.message)
  process.exit(1)
}

if (!data || !data.post_ideas || data.post_ideas.length === 0) {
  console.log('❌ No post ideas found - generation may have failed')
  process.exit(1)
}

console.log('✅ Strategy generated! Checking service_period:\n')
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
  console.log('🎉 SUCCESS: service_period is now being tracked!')
} else {
  console.log('❌ FAIL: service_period still not set')
}
