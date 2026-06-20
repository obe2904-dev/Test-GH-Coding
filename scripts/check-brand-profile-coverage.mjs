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
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.log('❌ Error:', error.message)
  process.exit(1)
}

if (!data) {
  console.log('❌ No brand profile found')
  process.exit(1)
}

console.log('📊 Cafe Faust Brand Profile Coverage:\n')

const fieldsCheckedByQuickSuggestions = [
  'natural_moments',
  'ideas_to_avoid', 
  'tone_of_voice',
  'voice_rationale',
  'emotional_promise',
  'content_exclusions',
  'location_intelligence',
  'posting_occasions'
]

fieldsCheckedByQuickSuggestions.forEach(field => {
  const value = data[field]
  const hasValue = value && (
    (typeof value === 'string' && value.trim()) ||
    (Array.isArray(value) && value.length > 0) ||
    (typeof value === 'object' && value !== null && Object.keys(value).length > 0)
  )
  console.log(`${hasValue ? '✅' : '❌'} ${field}: ${hasValue ? 'Populated' : 'Empty/null'}`)
})

console.log('\n💡 Quick Suggestions Warning Diagnosis:')
console.log('   The function checks if any of these fields populate the "parts" array.')
console.log('   If all are empty, it shows: "Paid tier but no brand profile found"')
