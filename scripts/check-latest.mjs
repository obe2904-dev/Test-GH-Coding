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
  .from('weekly_strategies')
  .select('week_start, post_ideas, status, generated_at')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('generated_at', { ascending: false })
  .limit(1)
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log('📊 Latest strategy:')
console.log('   Week:', data.week_start)
console.log('   Status:', data.status)
console.log('   Generated:', data.generated_at)
console.log('   Post ideas:', data.post_ideas?.length || 0)

if (data.status === 'error') {
  console.log('\n⚠️  Generation failed')
  console.log('   Check Edge Function logs for error message')
}
