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

console.log('🔍 Deep dive into V5 voice structure...\n')

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

if (!voice) {
  console.log('❌ No voice profile found')
  Deno.exit(1)
}

console.log('📊 Full voice.tone_dna structure:')
console.log(JSON.stringify(voice.tone_dna, null, 2))
console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
console.log('📊 Full voice.voice_archetype structure:')
console.log(JSON.stringify(voice.voice_archetype, null, 2))
console.log('')
