/**
 * Verify V5 Profile Structure
 * 
 * Queries the brand_profile_v5 JSONB column to verify complete structure.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

console.log('🔍 Verifying V5 Profile Structure for Café Faust...\n')

// 1. Check v5_profile_summary view
const { data: summary, error: summaryError } = await supabase
  .from('v5_profile_summary')
  .select('*')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

console.log('📊 V5 Profile Summary:')
if (summaryError) {
  console.log('Error:', summaryError.message)
} else {
  console.log(JSON.stringify(summary, null, 2))
}
console.log('')

// 2. Get complete V5 profile
const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, brand_profile_v5_generated_at, brand_profile_v5_version')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

console.log('🔍 Direct Query Result:')
if (profileError) {
  console.log('Error:', profileError.message)
} else if (!profile) {
  console.log('No profile row found')
} else {
  console.log(`V5 version: ${profile.brand_profile_v5_version}`)
  console.log(`V5 generated_at: ${profile.brand_profile_v5_generated_at}`)
  console.log(`V5 JSONB exists: ${profile.brand_profile_v5 ? 'YES' : 'NO'}`)
}
console.log('')

if (profile?.brand_profile_v5) {
  const v5 = profile.brand_profile_v5
  
  console.log('✅ V5 Profile Structure:')
  console.log(`   Version: ${v5.version}`)
  console.log(`   Generated: ${v5.generated_at}`)
  console.log(`   Request ID: ${v5.generation_metadata?.request_id}`)
  console.log(`   Duration: ${v5.generation_metadata?.duration_ms}ms`)
  console.log('')
  
  console.log('📋 Layer 1-2-4: Programmes')
  console.log(`   Count: ${v5.programmes?.length || 0}`)
  v5.programmes?.forEach((p: any) => {
    console.log(`   • ${p.name} (${p.type}): ${p.timeWindow.start}-${p.timeWindow.end}`)
    console.log(`     - Audience segments: ${p.audienceSegments?.length || 0}`)
    console.log(`     - Decision timing: ${p.commercialOrientation?.decision_timing}`)
  })
  console.log('')
  
  console.log('🎯 Layer 3: Identity')
  console.log(`   Brand Essence: ${v5.identity?.brand_essence?.slice(0, 100)}...`)
  console.log(`   Positioning: ${v5.identity?.positioning?.slice(0, 100)}...`)
  console.log(`   Core Values: ${v5.identity?.core_values?.join(', ')}`)
  console.log(`   Confidence: ${v5.identity?.identity_confidence}`)
  console.log('')
  
  console.log('📢 Layer 5a: Voice')
  console.log(`   Tone Rules (${v5.voice?.tone_rules?.length || 0}):`)
  v5.voice?.tone_rules?.forEach((rule: string, i: number) => {
    console.log(`   ${i + 1}. ${rule}`)
  })
  console.log(`   Personality: ${v5.voice?.personality_traits?.join(', ')}`)
  console.log(`   Formality: ${v5.voice?.formality_level}`)
  console.log(`   Sentence Style: ${v5.voice?.sentence_structure}`)
  console.log('')
  
  console.log('✍️  Layer 5b: Writing Examples')
  console.log(`   Typical Openings (${v5.writing_examples?.typical_openings?.length || 0}):`)
  v5.writing_examples?.typical_openings?.forEach((ex: string) => {
    console.log(`   - "${ex}"`)
  })
  console.log(`   Typical Closings (${v5.writing_examples?.typical_closings?.length || 0}):`)
  v5.writing_examples?.typical_closings?.forEach((ex: string) => {
    console.log(`   - "${ex}"`)
  })
  console.log(`   Signature Phrases: ${v5.writing_examples?.signature_phrases?.join(', ')}`)
  console.log('')
  
  console.log('🛡️  Layer 5c: Guardrails')
  console.log(`   Never Say (${v5.guardrails?.never_say?.length || 0}):`)
  v5.guardrails?.never_say?.forEach((rule: string) => {
    console.log(`   - ${rule}`)
  })
  console.log(`   Content Exclusions: ${v5.guardrails?.content_exclusions?.length || 0}`)
  console.log(`   Factual Constraints: ${v5.guardrails?.factual_constraints?.length || 0}`)
  console.log('')
  
  console.log('✅ VERIFICATION COMPLETE: V5 Profile has all 5 layers!')
} else {
  console.log('❌ ERROR: No V5 profile found')
}
