#!/usr/bin/env node
/**
 * Verify Strategic Segments Fix - June 12, 2026
 * Check if business_identity_persona now includes strategic segments
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env manually
const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1]] = match[2]
  }
})

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Cafe Faust

console.log('🔍 Verifying Strategic Segments in Business Identity Persona...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, business_identity_persona, strategic_audience_segments')
  .eq('business_id', businessId)
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (!data) {
  console.error('❌ No data found for business')
  process.exit(1)
}

const persona = data.business_identity_persona || ''

console.log('📊 VERIFICATION RESULTS:\n')
console.log('1. Persona length:', persona.length, 'characters')
console.log('2. Has "Strategiske målgrupper":', persona.includes('Strategiske målgrupper') ? '✅ YES' : '❌ NO')
console.log('3. Has "primær":', persona.includes('primær') ? '✅ YES' : '❌ NO')
console.log('4. Has "sekundær":', persona.includes('sekundær') ? '✅ YES' : '❌ NO')
console.log('5. Has OLD "Studerende" (should be NO):', persona.includes('Studerende') ? '❌ YES (bad)' : '✅ NO (good)')
console.log('6. Has OLD "score" format (should be NO):', persona.includes('score') ? '❌ YES (bad)' : '✅ NO (good)')

console.log('\n📝 STRATEGIC SEGMENTS SECTION:\n')

// Extract the strategic segments section
const strategicMatch = persona.match(/Strategiske målgrupper:([\s\S]*?)(?:TILBUD:|KULINARISK KARAKTER:|$)/)
if (strategicMatch) {
  console.log(strategicMatch[1].trim())
} else {
  console.log('❌ Strategic segments section not found')
}

console.log('\n💾 STRATEGIC_AUDIENCE_SEGMENTS FIELD:\n')
console.log(JSON.stringify(data.strategic_audience_segments, null, 2))

console.log('\n📄 FULL PERSONA:\n')
console.log(persona)
console.log('\n' + '='.repeat(80))

const hasStrategic = persona.includes('Strategiske målgrupper')
const hasPrimary = persona.includes('primær')
const hasSecondary = persona.includes('sekundær')
const hasOldData = persona.includes('Studerende') || persona.includes('score')

if (hasStrategic && hasPrimary && hasSecondary && !hasOldData) {
  console.log('\n✅ SUCCESS: Strategic segments are now included in persona!')
  process.exit(0)
} else {
  console.log('\n❌ FAIL: Strategic segments missing or old data present')
  process.exit(1)
}
