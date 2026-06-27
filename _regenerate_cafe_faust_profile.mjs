#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'npm:@supabase/supabase-js@2.39.7'

// Read .env file
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

const CAFE_FAUST_ID = '36e24a84-c32d-4123-910a-1bb2e64d34af'

console.log('============================================================')
console.log('REGENERATING CAFÉ FAUST BRAND PROFILE')
console.log('============================================================\n')

// Get current vocabulary (before regeneration)
console.log('📊 BEFORE REGENERATION:')
console.log('-----------------------------------------------------------')
const { data: beforeProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const beforeVocab = beforeProfile?.brand_profile_v5?.voice?.tone_dna?.location_driver?.natural_vocabulary || []
console.log('Natural Vocabulary:')
beforeVocab.forEach((term, idx) => {
  const flag = (term.includes('vandet') || term === 'udsigt' || term === 'udsigten') ? '❌' : '✅'
  console.log(`  ${idx + 1}. "${term}" ${flag}`)
})
console.log('')

// Call brand-profile-generator-v5
console.log('🚀 Calling brand-profile-generator-v5...')
const startTime = Date.now()

const response = await fetch(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${envVars.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      businessId: CAFE_FAUST_ID,
      forceRegenerate: true  // Force regeneration even if profile exists
    })
  }
)

const duration = ((Date.now() - startTime) / 1000).toFixed(1)

if (!response.ok) {
  const error = await response.text()
  console.error('❌ Error:', error)
  Deno.exit(1)
}

const result = await response.json()
console.log(`✅ Completed in ${duration}s\n`)

// Get updated vocabulary (after regeneration)
console.log('📊 AFTER REGENERATION:')
console.log('-----------------------------------------------------------')
const { data: afterProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const afterVocab = afterProfile?.brand_profile_v5?.voice?.tone_dna?.location_driver?.natural_vocabulary || []
console.log('Natural Vocabulary:')
afterVocab.forEach((term, idx) => {
  const flag = (term.includes('vandet') || term === 'udsigt' || term === 'udsigten') ? '❌' : '✅'
  console.log(`  ${idx + 1}. "${term}" ${flag}`)
})
console.log('')

// Analysis
console.log('============================================================')
console.log('ANALYSIS:')
console.log('============================================================\n')

const beforeProblematic = beforeVocab.filter(t => t.includes('vandet') || t === 'udsigt' || t === 'udsigten')
const afterProblematic = afterVocab.filter(t => t.includes('vandet') || t === 'udsigt' || t === 'udsigten')

console.log('Problematic terms before:', beforeProblematic.length)
if (beforeProblematic.length > 0) {
  console.log('  -', beforeProblematic.join(', '))
}

console.log('Problematic terms after:', afterProblematic.length)
if (afterProblematic.length > 0) {
  console.log('  - ❌', afterProblematic.join(', '))
  console.log('\n⚠️ WARNING: Blacklist did not remove all problematic terms!')
} else {
  console.log('  - ✅ NONE')
  console.log('\n✅ SUCCESS: All problematic terms removed by blacklist!')
}

console.log('\nTerms removed:', beforeProblematic.filter(t => !afterProblematic.includes(t)).join(', ') || 'none')
console.log('Terms kept:', beforeVocab.filter(t => afterVocab.includes(t)).join(', '))

const firstTerm = afterVocab[0]
const { data: business } = await supabase
  .from('businesses')
  .select('local_location_reference')
  .eq('id', CAFE_FAUST_ID)
  .single()

const llr = business?.local_location_reference

console.log('\nEnforcement check:')
console.log('  local_location_reference:', `"${llr}"`)
console.log('  First vocabulary term:', `"${firstTerm}"`)
console.log('  Match:', firstTerm === llr ? '✅ YES' : '❌ NO')

console.log('\n============================================================\n')
