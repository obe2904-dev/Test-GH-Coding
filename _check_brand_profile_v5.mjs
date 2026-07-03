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

console.log('🔍 Checking brand_profile_v5 structure...\n')

const { data, error } = await supabase
  .from('businesses')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

const profile = data.brand_profile_v5

console.log('📊 Voice structure:\n')
if (profile?.voice?.tone_dna) {
  console.log('tone_dna.formality_level:', profile.voice.tone_dna.formality_level)
  console.log('tone_dna.recommended_tone:', profile.voice.tone_dna.recommended_tone)
  console.log('')
}

if (profile?.voice?.voice_archetype) {
  console.log('voice_archetype.formality_level:', profile.voice.voice_archetype.formality_level)
  console.log('')
}

// Check for inconsistency
const toneDnaFormality = profile?.voice?.tone_dna?.formality_level
const archetypeFormality = profile?.voice?.voice_archetype?.formality_level
const recommendedTone = profile?.voice?.tone_dna?.recommended_tone

if (toneDnaFormality || archetypeFormality) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('FORMALITY CHECK:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  if (toneDnaFormality) {
    console.log('✓ tone_dna.formality_level:', toneDnaFormality)
  }
  if (archetypeFormality) {
    console.log('✓ voice_archetype.formality_level:', archetypeFormality)
  }
  if (recommendedTone) {
    console.log('✓ tone_dna.recommended_tone:', recommendedTone)
  }
  console.log('')
  
  // Check for inconsistency
  const hasSemiFormal = toneDnaFormality === 'semi-formal' || archetypeFormality === 'semi-formal'
  const hasCasualTone = recommendedTone?.toLowerCase().includes('casual')
  
  if (hasSemiFormal && hasCasualTone) {
    console.log('❌ INCONSISTENCY DETECTED!')
    console.log('   Formality says "semi-formal"')
    console.log('   But recommended_tone says "' + recommendedTone + '"')
    console.log('')
    console.log('✅ Recommendation: Change "semi-formal" → "casual"')
  } else {
    console.log('✅ Values appear consistent')
  }
}

console.log('')
