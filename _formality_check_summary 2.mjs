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

console.log('🔍 FORMALITY ANALYSIS\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Check actual database
const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

const voice = data.brand_profile_v5?.voice

console.log('📊 ACTUAL DATA (Café Faust):')
console.log('')
console.log('   owner_voice.register_level:', voice?.tone_dna?.owner_voice?.register_level || '(not set)')
console.log('   culinary_character.formality_requirement:', voice?.tone_dna?.culinary_character?.formality_requirement || '(not set)')
console.log('   tone_dna.recommended_tone.tone_positioning:', voice?.tone_dna?.recommended_tone?.tone_positioning || '(not set)')
console.log('   voice_archetype.formality_level:', voice?.voice_archetype?.formality_level || '(not set - missing archetype)')
console.log('')

console.log('📋 CODE EXPECTATIONS (from voice-archetypes.ts):')
console.log('')
console.log('   For hybrid_cafe + waterfront:')
console.log('   → formality_level should be: "casual_friend"')
console.log('')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('❓ QUESTION:')
console.log('')
console.log('   I could NOT find "semi-formal" anywhere in the current')
console.log('   V5 profile for Café Faust, nor in the voice-archetypes.ts')
console.log('   code.')
console.log('')
console.log('   Possible explanations:')
console.log('   1. Different business has "semi-formal"?')
console.log('   2. Old V4 profile format?')
console.log('   3. AI-generated tone_dna before archetype fix?')
console.log('')
console.log('   Where are you seeing "semi-formal"?')
console.log('')
