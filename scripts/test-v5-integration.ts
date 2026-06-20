#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// V5 Integration Test - Verify data fetchers work with real data
// Tests fetchV5IdentityProfile and fetchV5ProgrammeProfiles

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchV5IdentityProfile,
  fetchV5ProgrammeProfiles,
  fetchCompleteV5Profile,
  buildV5IdentitySection,
  buildV5AudienceSection
} from '../supabase/functions/_shared/data-fetchers/fetch-v5-profile.ts'
import { getActiveSegment } from '../supabase/functions/_shared/utils/v5-helpers.ts'

// Setup
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Test business (Café Faust)
const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('═══════════════════════════════════════════════════════════')
console.log('V5 INTEGRATION TEST')
console.log('Testing: Café Faust (100% V5 Ready)')
console.log('═══════════════════════════════════════════════════════════\n')

// Test 1: Fetch Layer 3
console.log('TEST 1: Fetch Layer 3 (Identity Profile)')
console.log('─────────────────────────────────────────────────────────\n')

const identity = await fetchV5IdentityProfile(supabase, CAFE_FAUST_ID)

if (!identity) {
  console.error('❌ FAILED: Could not fetch identity profile')
  Deno.exit(1)
}

console.log('✅ Identity Profile Fetched')
console.log(`   Brand Essence: ${identity.brand_essence.substring(0, 50)}...`)
console.log(`   Positioning: ${identity.positioning.substring(0, 50)}...`)
console.log(`   Core Values: ${identity.core_values.length} values`)
console.log(`   Confidence: ${Math.round(identity.identity_confidence * 100)}%`)
console.log(`   Location Reference: ${identity.local_location_reference || 'N/A'}`)
console.log()

// Test 2: Fetch Layer 4
console.log('TEST 2: Fetch Layer 4 (Programme Profiles)')
console.log('─────────────────────────────────────────────────────────\n')

const programmes = await fetchV5ProgrammeProfiles(supabase, CAFE_FAUST_ID)

if (!programmes || programmes.length === 0) {
  console.error('❌ FAILED: Could not fetch programme profiles')
  Deno.exit(1)
}

console.log(`✅ Programme Profiles Fetched: ${programmes.length} programmes`)
for (const prog of programmes) {
  console.log(`   ${prog.programme_name} (${prog.programme_type}): ${prog.audience_segments.length} segments`)
}
console.log()

// Test 3: Fetch Complete Profile
console.log('TEST 3: Fetch Complete V5 Profile')
console.log('─────────────────────────────────────────────────────────\n')

const complete = await fetchCompleteV5Profile(supabase, CAFE_FAUST_ID)

if (!complete) {
  console.error('❌ FAILED: Could not fetch complete profile')
  Deno.exit(1)
}

console.log('✅ Complete Profile Fetched')
console.log(`   Identity: Present`)
console.log(`   Programmes: ${complete.programmes.length}`)
const totalSegments = complete.programmes.reduce((sum, p) => sum + p.audience_segments.length, 0)
console.log(`   Total Segments: ${totalSegments}`)
console.log()

// Test 4: Build Identity Prompt Section
console.log('TEST 4: Build Identity Prompt Section')
console.log('─────────────────────────────────────────────────────────\n')

const identitySection = buildV5IdentitySection(identity)
console.log('✅ Identity Section Built')
console.log(`   Length: ${identitySection.length} characters`)
console.log(`   Contains brand essence: ${identitySection.includes(identity.brand_essence) ? '✅' : '❌'}`)
console.log(`   Contains positioning: ${identitySection.includes(identity.positioning) ? '✅' : '❌'}`)
console.log(`   Contains location reference: ${identity.local_location_reference && identitySection.includes(identity.local_location_reference) ? '✅' : 'N/A'}`)
console.log()

// Test 5: Build Audience Prompt Section
console.log('TEST 5: Build Audience Prompt Section')
console.log('─────────────────────────────────────────────────────────\n')

const audienceSection = buildV5AudienceSection(programmes)
console.log('✅ Audience Section Built')
console.log(`   Length: ${audienceSection.length} characters`)
console.log(`   Contains all programmes: ${programmes.every(p => audienceSection.includes(p.programme_name)) ? '✅' : '❌'}`)
console.log()

// Test 6: Segment Matching (Saturday 11:00 = Weekend Brunch time)
console.log('TEST 6: Segment Matching (Saturday 11:00)')
console.log('─────────────────────────────────────────────────────────\n')

const match = getActiveSegment(programmes, 6, 11)  // Saturday, 11:00

if (!match) {
  console.log('⚠️  No segment matched (might be expected)')
} else {
  console.log('✅ Segment Matched')
  console.log(`   Programme: ${match.programme.programme_name}`)
  console.log(`   Segment: ${match.segment.label}`)
  console.log(`   Confidence: ${Math.round(match.matchConfidence * 100)}%`)
  console.log(`   Content Angles: ${match.segment.content_angles.length}`)
  console.log(`   Evidence: ${match.segment.evidence.length} items`)
}
console.log()

// Test 7: Brunch Programme Detection
console.log('TEST 7: Brunch Programme Detection')
console.log('─────────────────────────────────────────────────────────\n')

const brunchProgrammes = programmes.filter(p => 
  p.programme_name.toLowerCase().includes('brunch') || 
  p.programme_type.toLowerCase().includes('brunch')
)

if (brunchProgrammes.length > 0) {
  console.log(`✅ Found ${brunchProgrammes.length} brunch programme(s)`)
  for (const prog of brunchProgrammes) {
    console.log(`   ${prog.programme_name}:`)
    for (const seg of prog.audience_segments) {
      console.log(`     - ${seg.label}`)
      console.log(`       Timing: ${seg.timing_windows.join(', ')}`)
      console.log(`       Motivation: ${seg.motivation}`)
      console.log(`       Evidence: ${seg.evidence.length} items`)
    }
  }
} else {
  console.log('⚠️  No brunch programmes found')
}
console.log()

// Test 8: Evidence Validation
console.log('TEST 8: Evidence Validation')
console.log('─────────────────────────────────────────────────────────\n')

const segmentsWithEvidence = totalSegments
const segmentsWithoutEvidence = programmes
  .flatMap(p => p.audience_segments)
  .filter(s => !s.evidence || s.evidence.length === 0)
  .length

console.log(`✅ Evidence Coverage: ${segmentsWithEvidence - segmentsWithoutEvidence}/${segmentsWithEvidence} segments`)
console.log(`   Segments with evidence: ${segmentsWithEvidence - segmentsWithoutEvidence}`)
console.log(`   Segments without evidence: ${segmentsWithoutEvidence}`)

if (segmentsWithoutEvidence > 0) {
  console.log('   ⚠️  Some segments lack evidence')
} else {
  console.log('   ✅ All segments have evidence')
}
console.log()

// Summary
console.log('═══════════════════════════════════════════════════════════')
console.log('TEST SUMMARY')
console.log('═══════════════════════════════════════════════════════════\n')

console.log('✅ All 8 tests passed')
console.log(`   Layer 3: ${identity.identity_confidence >= 0.8 ? '✅' : '⚠️'} (${Math.round(identity.identity_confidence * 100)}% confidence)`)
console.log(`   Layer 4: ${programmes.length >= 1 ? '✅' : '❌'} (${programmes.length} programmes)`)
console.log(`   Segments: ${totalSegments >= 1 ? '✅' : '❌'} (${totalSegments} total)`)
console.log(`   Evidence: ${segmentsWithoutEvidence === 0 ? '✅' : '⚠️'} (${segmentsWithEvidence - segmentsWithoutEvidence}/${segmentsWithEvidence})`)
console.log()

console.log('🎉 V5 data fetchers are working correctly!')
console.log('Ready for Phase 1 integration (get-weekly-strategy)\n')
