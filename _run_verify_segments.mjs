#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const envContent = await Deno.readTextFile('.env')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/)
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
})

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔍 Verifying Strategic Segments in Business Identity Persona\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, business_identity_persona')
  .eq('business_id', businessId)
  .single()

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

const persona = data.business_identity_persona || ''

console.log('📊 Verification Results:')
console.log('─'.repeat(60))

// Check for OLD location data
const hasStudentsGeneric = persona.includes('Studerende')
const hasScoreFormat = persona.includes('score')

console.log(`❌ Has OLD "Studerende" (generic):  ${hasStudentsGeneric ? 'YES (BAD)' : 'NO (GOOD)'}`)
console.log(`❌ Has OLD "score" format:          ${hasScoreFormat ? 'YES (BAD)' : 'NO (GOOD)'}`)

console.log('')

// Check for NEW strategic segments
const hasStratificHeader = persona.includes('Strategiske målgrupper')
const hasPrimarySegment = persona.includes('Aftensmad ved åen')
const hasPrimaryLabel = persona.includes('primær')
const hasSecondaryLabel = persona.includes('sekundær')

console.log(`✅ Has "Strategiske målgrupper":    ${hasStratificHeader ? 'YES (GOOD)' : 'NO (BAD)'}`)
console.log(`✅ Has "Aftensmad ved åen":         ${hasPrimarySegment ? 'YES (GOOD)' : 'NO (BAD)'}`)
console.log(`✅ Has "primær" label:              ${hasPrimaryLabel ? 'YES (GOOD)' : 'NO (BAD)'}`)
console.log(`✅ Has "sekundær" label:            ${hasSecondaryLabel ? 'YES (GOOD)' : 'NO (BAD)'}`)

console.log('')

// Extract audience section
const audienceMatch = persona.match(/Strategiske målgrupper:(.*?)(?:###|Kommunikationsstrategi|$)/s)
if (audienceMatch) {
  console.log('📋 Audience Section Extract:')
  console.log('─'.repeat(60))
  console.log(audienceMatch[1].trim())
  console.log('─'.repeat(60))
} else {
  console.log('⚠️  No "Strategiske målgrupper" section found')
}

console.log('')

// Overall assessment
if (hasStratificHeader && hasPrimarySegment && hasPrimaryLabel && hasSecondaryLabel) {
  console.log('✅ PASS: Persona contains NEW strategic segments format')
} else if (hasStudentsGeneric || hasScoreFormat) {
  console.log('❌ FAIL: Persona still using OLD generic location format')
} else {
  console.log('⚠️  PARTIAL: Some strategic elements present but incomplete')
}
