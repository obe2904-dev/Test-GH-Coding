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

// Generate for week of June 15, 2026 (fresh week to avoid cache)
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

console.log('Status:', res.status, res.statusText)

if (res.ok) {
  const data = await res.json()
  console.log('✅ Success:', JSON.stringify(data, null, 2))
} else {
  const text = await res.text()
  console.error('❌ Failed:', text)
}
