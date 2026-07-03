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

console.log('🔍 Checking tone_dna structure...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('tone_dna')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

console.log('📊 tone_dna structure:\n')
console.log(JSON.stringify(data.tone_dna, null, 2))
console.log('')

if (data.tone_dna?.formality_level) {
  console.log('⚠️  FOUND formality_level in tone_dna:')
  console.log('   tone_dna.formality_level:', data.tone_dna.formality_level)
  console.log('   tone_dna.recommended_tone:', data.tone_dna.recommended_tone)
  console.log('')
  
  if (data.tone_dna.formality_level === 'semi-formal' && 
      data.tone_dna.recommended_tone?.includes('casual')) {
    console.log('❌ INCONSISTENCY CONFIRMED')
    console.log('   Should change "semi-formal" → "casual"')
  } else {
    console.log('✅ Values are consistent')
  }
}

console.log('')
