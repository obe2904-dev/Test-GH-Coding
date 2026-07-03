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

console.log('🔍 Checking formality_level in V5 profile...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

const profile = data.brand_profile_v5

if (!profile) {
  console.log('❌ No V5 profile found')
  Deno.exit(1)
}

console.log('📊 Current formality values:\n')

const toneDnaFormality = profile?.voice?.tone_dna?.formality_level
const archetypeFormality = profile?.voice?.voice_archetype?.formality_level
const recommendedTone = profile?.voice?.tone_dna?.recommended_tone

console.log('   tone_dna.formality_level:', toneDnaFormality || '(not set)')
console.log('   tone_dna.recommended_tone:', recommendedTone || '(not set)')
console.log('   voice_archetype.formality_level:', archetypeFormality || '(not set)')
console.log('')

// Check for inconsistency
const hasSemiFormal = toneDnaFormality === 'semi-formal' || archetypeFormality === 'semi-formal'
const hasCasualTone = recommendedTone?.toLowerCase().includes('casual')

if (hasSemiFormal && hasCasualTone) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('❌ INCONSISTENCY DETECTED!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('   Formality level: "semi-formal"')
  console.log('   Recommended tone: "' + recommendedTone + '"')
  console.log('')
  console.log('   These conflict! "semi-formal" implies structured language,')
  console.log('   but "casual-varm" should use "casual" formality.')
  console.log('')
  console.log('✅ FIX: Change formality_level from "semi-formal" → "casual"')
  console.log('')
  console.log('   Location(s) to update:')
  if (toneDnaFormality === 'semi-formal') {
    console.log('   • brand_profile_v5.voice.tone_dna.formality_level')
  }
  if (archetypeFormality === 'semi-formal') {
    console.log('   • brand_profile_v5.voice.voice_archetype.formality_level')
  }
} else {
  console.log('✅ Values are consistent')
}

console.log('')
