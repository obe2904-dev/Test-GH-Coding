#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --env-file=.env

/**
 * Check what's currently in brand_profile_v5 JSONB column
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking Current V5 Brand Profile Structure\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Fetch Café Faust profile
const { data: profile, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, business_name')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .single()

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

console.log(`📍 Business: ${profile.business_name || 'Café Faust'}\n`)

if (!profile.brand_profile_v5) {
  console.log('⚠️  No V5 profile found yet. Please regenerate the brand profile.')
  Deno.exit(0)
}

const v5 = profile.brand_profile_v5 as any

console.log('✅ CURRENT V5 STRUCTURE:\n')

// Layer 1: Programmes
if (v5.programmes) {
  console.log(`📊 Layer 1: Programmes (${v5.programmes.length} detected)`)
  v5.programmes.forEach((p: any) => {
    console.log(`   ✓ ${p.type}: ${p.name}`)
  })
  console.log('')
}

// Layer 2: Commercial Orientation
if (v5.commercialOrientation) {
  console.log('💼 Layer 2: Commercial Orientation')
  console.log(`   ✓ Decision timing: ${v5.commercialOrientation.decision_timing}`)
  console.log(`   ✓ Goal split:`, v5.commercialOrientation.baseline_goal_split)
  console.log('')
}

// Layer 3: Identity
if (v5.identity) {
  console.log('🎯 Layer 3: Identity')
  console.log(`   ✓ Brand essence: "${v5.identity.brand_essence?.slice(0, 80)}..."`)
  console.log(`   ✓ Positioning: "${v5.identity.positioning?.slice(0, 80)}..."`)
  console.log(`   ✓ Core values: ${v5.identity.core_values?.length || 0} values`)
  console.log(`   ✓ What makes us different: "${v5.identity.what_makes_us_different?.slice(0, 80)}..."`)
  console.log('')
}

// Layer 4: Audience Segments
if (v5.audienceSegments) {
  console.log(`👥 Layer 4: Audience Segments (${v5.audienceSegments.length} segments)`)
  v5.audienceSegments.forEach((seg: any) => {
    console.log(`   ✓ ${seg.segment_name} (${seg.confidence})`)
  })
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Check for missing sections
console.log('❌ MISSING FROM V5 (NOT YET IMPLEMENTED):\n')
console.log('   ❌ voice: { tone, writing_style, personality }')
console.log('   ❌ writing_examples: { typical_openings, typical_closings, signature_phrases }')
console.log('   ❌ guardrails: { never_say, things_to_avoid }')
console.log('')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Check legacy columns
const { data: legacy, error: legacyError } = await supabase
  .from('business_brand_profile')
  .select('tone_of_voice, typical_openings, typical_closings, never_say, signature_phrases')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .single()

if (!legacyError && legacy) {
  console.log('📦 LEGACY DATA (Still in separate columns):\n')
  
  if (legacy.tone_of_voice) {
    console.log(`   ✓ tone_of_voice: "${legacy.tone_of_voice.slice(0, 100)}..."`)
  }
  if (legacy.typical_openings && legacy.typical_openings.length > 0) {
    console.log(`   ✓ typical_openings: ${legacy.typical_openings.length} examples`)
    legacy.typical_openings.forEach((opening: string, i: number) => {
      console.log(`      ${i + 1}. "${opening}"`)
    })
  }
  if (legacy.typical_closings && legacy.typical_closings.length > 0) {
    console.log(`   ✓ typical_closings: ${legacy.typical_closings.length} examples`)
    legacy.typical_closings.forEach((closing: string, i: number) => {
      console.log(`      ${i + 1}. "${closing}"`)
    })
  }
  if (legacy.never_say && legacy.never_say.length > 0) {
    console.log(`   ✓ never_say: ${legacy.never_say.length} rules`)
  }
  if (legacy.signature_phrases && legacy.signature_phrases.length > 0) {
    console.log(`   ✓ signature_phrases: ${legacy.signature_phrases.length} phrases`)
  }
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('💡 NEXT STEPS:\n')
console.log('Phase 0 (COMPLETE): Database cleanup')
console.log('   ✅ Code updated (do_not_say removed)')
console.log('   ✅ Edge Functions deployed')
console.log('   ⏳ Database migration pending (drop do_not_say column)')
console.log('')
console.log('Phase 1-5 (PLANNED, NOT STARTED):')
console.log('   • Add voice, writing_examples, guardrails to Layer 3')
console.log('   • Migrate legacy data into V5 structure')
console.log('   • Update frontend to display new sections')
console.log('   • Add AI generation for missing data')
console.log('')
console.log('📄 See: LAYER3-VOICE-GUARDRAILS-IMPLEMENTATION.md for full plan')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
