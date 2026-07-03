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

console.log('🔍 Checking formality_level inconsistency...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('formality_level, tone_dna')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

console.log('📊 Current values for Café Faust:\n')
console.log('   formality_level:', JSON.stringify(data.formality_level))
console.log('   tone_dna.recommended_tone:', JSON.stringify(data.tone_dna?.recommended_tone))
console.log('')

if (data.formality_level === 'semi-formal' && data.tone_dna?.recommended_tone?.includes('casual')) {
  console.log('⚠️  INCONSISTENCY DETECTED')
  console.log('   formality_level = "semi-formal"')
  console.log('   recommended_tone = "' + data.tone_dna.recommended_tone + '"')
  console.log('')
  console.log('✅ Should be aligned to: "casual"')
} else if (data.formality_level === 'casual') {
  console.log('✅ Already fixed!')
} else {
  console.log('ℹ️  Current state:')
  console.log('   formality_level:', data.formality_level)
  console.log('   recommended_tone:', data.tone_dna?.recommended_tone)
}

console.log('')
