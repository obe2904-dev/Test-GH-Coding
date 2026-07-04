// Test brand-profile-generator with Café Faust
import fs from 'node:fs'
import path from 'node:path'

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

function loadEnvFromFiles() {
  const cwd = process.cwd()
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename)
    if (!fs.existsSync(fullPath)) continue
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'))
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null) process.env[k] = v
      }
    } catch {
      // ignore
    }
  }
}

loadEnvFromFiles()

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const businessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'  // Café Faust

console.log('Calling brand-profile-generator for Café Faust...')
console.log('Business ID:', businessId)
console.log('Force regenerate: true')
console.log('')

const response = await fetch('https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`
  },
  body: JSON.stringify({
    business_id: businessId,
    force_regenerate: true,
    lang_code: 'da-DK'
  })
})

const result = await response.json()

if (!response.ok) {
  console.error('Error:', result)
  process.exit(1)
}

console.log('✅ Generation completed in', result.generation_time_ms, 'ms')
console.log('')

const profile = result.brand_profile

if (!profile) {
  console.error('No brand_profile in response')
  console.log(JSON.stringify(result, null, 2))
  process.exit(1)
}

console.log('=== BRAND PROFILE ===')
console.log('')
console.log('brand_essence:', profile.brand_essence?.value)
console.log('  → proof:', profile.brand_essence?.proof)
console.log('')
console.log('tone_of_voice:', profile.tone_of_voice?.value)
console.log('  → proof:', profile.tone_of_voice?.proof)
console.log('')
console.log('target_audience:', profile.target_audience?.value)
console.log('  → proof:', profile.target_audience?.proof)
console.log('')
console.log('communication_goal:', profile.communication_goal?.value)
console.log('  → proof:', profile.communication_goal?.proof)
console.log('')

// Check for "ved vandet" usage
const allText = JSON.stringify(profile, null, 2)
const vedVandetCount = (allText.match(/ved vandet/gi) || []).length
const vedÅenCount = (allText.match(/ved åen/gi) || []).length
const vedFjordenCount = (allText.match(/ved fjorden/gi) || []).length
const vedSøenCount = (allText.match(/ved søen/gi) || []).length
const vedHavnenCount = (allText.match(/ved havnen/gi) || []).length

console.log('=== LOCATION TERMINOLOGY CHECK ===')
console.log('"ved vandet" count:', vedVandetCount, vedVandetCount > 0 ? '❌ SHOULD USE SPECIFIC TERMS' : '✅')
console.log('"ved åen" count:', vedÅenCount)
console.log('"ved fjorden" count:', vedFjordenCount)
console.log('"ved søen" count:', vedSøenCount)
console.log('"ved havnen" count:', vedHavnenCount)
console.log('')

// Check for specific dish names in proofs
const proofText = [
  profile.brand_essence?.proof,
  profile.tone_of_voice?.proof,
  profile.target_audience?.proof,
  profile.communication_goal?.proof
].filter(Boolean).join(' ')

const hasPariserbøf = /pariserb[oø]f/i.test(proofText)
const hasCarpaccio = /carpaccio/i.test(proofText)
const hasSpecificDish = hasPariserbøf || hasCarpaccio || /brunch|cocktails|frokost/i.test(proofText)

console.log('=== PROOF SPECIFICITY CHECK ===')
console.log('Contains specific dishes/categories:', hasSpecificDish ? '✅' : '❌ TOO GENERIC')
console.log('  Pariserbøf:', hasPariserbøf ? '✅' : '—')
console.log('  Carpaccio:', hasCarpaccio ? '✅' : '—')
console.log('')

// Save full profile
fs.writeFileSync('_test-cafe-faust-profile.json', JSON.stringify(result, null, 2))
console.log('Full profile saved to _test-cafe-faust-profile.json')
