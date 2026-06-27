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
console.log('CAFÉ FAUST DATABASE STATE INVESTIGATION')
console.log('============================================================\n')

// 1. Check businesses table
console.log('1. BUSINESSES TABLE:')
console.log('-----------------------------------------------------------')
const { data: business, error: businessError } = await supabase
  .from('businesses')
  .select('id, name, website_url, local_location_reference, created_at, updated_at')
  .eq('id', CAFE_FAUST_ID)
  .single()

if (businessError) {
  console.error('Error:', businessError)
} else {
  console.log('Name:', business.name)
  console.log('Website:', business.website_url)
  console.log('local_location_reference:', business.local_location_reference || '❌ NULL')
  console.log('Created:', business.created_at)
  console.log('Updated:', business.updated_at)
}
console.log('')

// 2. Check brand profile
console.log('2. BRAND PROFILE (tone_dna):')
console.log('-----------------------------------------------------------')
const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5, updated_at')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (profileError) {
  console.error('Error:', profileError)
} else {
  const toneDNA = profile.brand_profile_v5?.voice?.tone_dna
  if (toneDNA) {
    console.log('Generated at:', toneDNA.generated_at || '❌ No timestamp')
    console.log('Profile updated:', profile.updated_at)
    console.log('')
    console.log('Location Driver:')
    console.log('  Primary dimension:', toneDNA.location_driver?.primary_dimension)
    console.log('  Strategic importance:', toneDNA.location_driver?.strategic_importance)
    console.log('')
    console.log('Natural Vocabulary:')
    const vocab = toneDNA.location_driver?.natural_vocabulary || []
    vocab.forEach((term, idx) => {
      const flag = (term.includes('vandet') || term === 'udsigt' || term === 'udsigten') ? '❌' : '✅'
      console.log(`  ${idx + 1}. "${term}" ${flag}`)
    })
  } else {
    console.log('❌ No tone_dna found in brand_profile_v5')
  }
}
console.log('')

// 3. Check location intelligence
console.log('3. LOCATION INTELLIGENCE:')
console.log('-----------------------------------------------------------')
const { data: location, error: locationError } = await supabase
  .from('business_location_intelligence')
  .select('business_id, local_location_reference, local_terminology, created_at, updated_at')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (locationError) {
  console.log('❌ No location intelligence record found')
  console.log('   (This is expected for free tier businesses)')
} else {
  console.log('local_location_reference:', location.local_location_reference || 'NULL')
  console.log('local_terminology:', location.local_terminology || 'NULL')
  console.log('Created:', location.created_at)
  console.log('Updated:', location.updated_at)
}
console.log('')

console.log('============================================================')
console.log('ANALYSIS:')
console.log('============================================================')

// Analysis
const hasBusinessLLR = !!business?.local_location_reference
const hasLocationLLR = !!location?.local_location_reference
const naturalVocab = profile?.brand_profile_v5?.voice?.tone_dna?.location_driver?.natural_vocabulary || []
const hasProblematicTerms = naturalVocab.some(t => t.includes('vandet') || t === 'udsigt' || t === 'udsigten')
const llrIsFirst = naturalVocab[0] === business?.local_location_reference || naturalVocab[0] === location?.local_location_reference

console.log('\nFindings:')
console.log('  businesses.local_location_reference:', hasBusinessLLR ? '✅ EXISTS' : '❌ NULL')
console.log('  location_intelligence.local_location_reference:', hasLocationLLR ? '✅ EXISTS' : 'N/A (free tier)')
console.log('  Problematic terms in vocabulary:', hasProblematicTerms ? '❌ YES ("ved vandet" or "udsigt")' : '✅ NONE')
console.log('  local_location_reference is first:', llrIsFirst ? '✅ YES' : '❌ NO')

console.log('\nLikely Root Cause:')
if (!hasBusinessLLR) {
  console.log('  → analyze-website did NOT extract local_location_reference from cafefaust.dk')
  console.log('  → Without source of truth, AI generated generic terms like "ved vandet"')
  console.log('  → FIX: Re-analyze cafefaust.dk to extract "ved åen i Aarhus"')
} else if (hasProblematicTerms && !llrIsFirst) {
  console.log('  → local_location_reference exists but was NOT enforced as first entry')
  console.log('  → Protection logic may not have been active when profile was generated')
  console.log('  → FIX: Regenerate brand profile with current protection code')
} else if (hasProblematicTerms && llrIsFirst) {
  console.log('  → local_location_reference IS first but AI added problematic terms anyway')
  console.log('  → Protection prompt may have been ignored or too weak')
  console.log('  → FIX: Strengthen constraints or add post-processing validation')
} else {
  console.log('  → ✅ Everything looks good! No problematic terms found.')
}

console.log('\n============================================================\n')
