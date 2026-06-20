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

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

// Calculate next Monday
const nextMonday = new Date()
nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7))
const weekStart = nextMonday.toISOString().split('T')[0]

console.log('🗑️  STEP 1: Deleting existing strategy for week', weekStart)

// First delete content plans that reference the strategy
const { error: planDeleteError } = await supabase
  .from('weekly_content_plans')
  .delete()
  .eq('business_id', businessId)
  .gte('week_start', weekStart)

if (planDeleteError) {
  console.error('❌ Error deleting content plans:', planDeleteError)
} else {
  console.log('✅ Deleted related content plans')
}

// Then delete the strategy
const { error: deleteError, count } = await supabase
  .from('weekly_strategies')
  .delete()
  .eq('business_id', businessId)
  .eq('week_start', weekStart)

if (deleteError) {
  console.error('❌ Error deleting:', deleteError)
  process.exit(1)
}

console.log(`✅ Deleted ${count || 0} existing strategy(ies)`)

console.log('\n🔄 STEP 2: Generating fresh strategy...')

// Generate fresh strategy
const res = await fetch('https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify({
    business_id: businessId,
    week_start: weekStart,
    target_post_count: 4
  })
})

console.log('📊 Status:', res.status, res.statusText)

if (res.ok) {
  const data = await res.json()
  console.log('✅ Strategy generation triggered')
  console.log('\n⏱️  Wait 15 seconds for generation to complete...')
  console.log('💡 Then run: node scripts/check-service-period.mjs')
} else {
  console.error('❌ Failed:', await res.text())
}
