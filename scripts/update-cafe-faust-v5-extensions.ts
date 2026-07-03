/**
 * Update Café Faust V5 Profile - Add 10 New Fields
 * 
 * Migrations:
 * Ref 2: Identity (2 fields) - business_description, category_keywords
 * Ref 4: Voice (2 fields) - avoid_examples, register_guidance
 * Ref 5: Writing Examples (3 fields) - do_say_examples, prefer_vocabulary, avoid_vocabulary
 * Ref 6: Audience Classification (3 fields) - business_model, primary_hook, audience_breadth
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔄 Fetching Café Faust V5 profile + legacy data...\n')

// 1. Get current V5 profile + legacy data
const { data: current, error: fetchError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, business_character, identity_keywords, voice_rationale, voice_examples, tone_model, audience_segments')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (fetchError || !current?.brand_profile_v5) {
  console.error('❌ Error fetching profile:', fetchError)
  Deno.exit(1)
}

const v5Profile = current.brand_profile_v5 as any

console.log('📊 Migration Plan: 10 fields across 4 sections\n')

// ============================================================================
// REF 2: IDENTITY (2 fields)
// ============================================================================

console.log('🆔 Ref 2: Identity Extensions (2 fields)')
console.log('─────────────────────────────────────────')

// business_description (from business_character)
const businessDescription = typeof current.business_character === 'string' 
  ? current.business_character 
  : 'Café, restaurant og bar ved åen'

v5Profile.identity.business_description = businessDescription
console.log('✅ business_description:', businessDescription.substring(0, 60) + '...')

// category_keywords (from identity_keywords)
const categoryKeywords = Array.isArray(current.identity_keywords) 
  ? current.identity_keywords 
  : ["café", "restaurant", "bar"]

v5Profile.identity.category_keywords = categoryKeywords
console.log('✅ category_keywords:', categoryKeywords.join(', '))

// ============================================================================
// REF 4: VOICE (2 fields)
// ============================================================================

console.log('\n📢 Ref 4: Voice Extensions (2 fields)')
console.log('─────────────────────────────────────────')

// avoid_examples (from tone_model.avoid_examples)
const avoidExamples = Array.isArray(current.tone_model?.avoid_examples)
  ? current.tone_model.avoid_examples
  : ["Oplev den autentiske stemning (for kampagneagtig tone)"]

v5Profile.voice.avoid_examples = avoidExamples
console.log('✅ avoid_examples:', avoidExamples.length, 'anti-patterns')

// register_guidance (from voice_rationale)
const registerGuidance = typeof current.voice_rationale === 'string'
  ? current.voice_rationale
  : ''

if (registerGuidance) {
  v5Profile.voice.register_guidance = registerGuidance
  console.log('✅ register_guidance:', registerGuidance.substring(0, 80) + '...')
} else {
  console.log('⚠️  register_guidance: (empty - no voice_rationale in legacy)')
}

// ============================================================================
// REF 5: WRITING EXAMPLES (3 fields)
// ============================================================================

console.log('\n✍️  Ref 5: Writing Examples Extensions (3 fields)')
console.log('─────────────────────────────────────────')

// do_say_examples (from voice_examples.do_say)
const doSayExamples = Array.isArray(current.voice_examples?.do_say)
  ? current.voice_examples.do_say
  : ["Udeservering ved åen", "Café-kultur i hjertet af Aarhus"]

v5Profile.writing_examples.do_say_examples = doSayExamples
console.log('✅ do_say_examples:', doSayExamples.length, 'perfect examples')

// prefer_vocabulary (from voice_examples.vocabulary.prefer)
const preferVocabulary = Array.isArray(current.voice_examples?.vocabulary?.prefer)
  ? current.voice_examples.vocabulary.prefer
  : ["Udsigt", "Cocktails", "Frokost", "Social"]

v5Profile.writing_examples.prefer_vocabulary = preferVocabulary
console.log('✅ prefer_vocabulary:', preferVocabulary.join(', '))

// avoid_vocabulary (from voice_examples.vocabulary.avoid)
const avoidVocabulary = Array.isArray(current.voice_examples?.vocabulary?.avoid)
  ? current.voice_examples.vocabulary.avoid
  : ["Hyggelig", "Lækker", "Indbydende", "Autentisk"]

v5Profile.writing_examples.avoid_vocabulary = avoidVocabulary
console.log('✅ avoid_vocabulary:', avoidVocabulary.join(', '))

// ============================================================================
// REF 6: AUDIENCE CLASSIFICATION (3 fields - NEW SECTION)
// ============================================================================

console.log('\n👥 Ref 6: Audience Classification (3 fields - NEW SECTION)')
console.log('─────────────────────────────────────────')

const audienceClassification = {
  business_model: current.audience_segments?.business_model_type || 'destination_led',
  primary_hook: current.audience_segments?.primary_copy_hook || 'location',
  audience_breadth: current.audience_segments?.audience_breadth || 'mixed',
  classification_reasoning: 'Waterfront destination with location-driven appeal. Mixed audience (families daytime, bar crowd evening). Content leads with location hook (ved åen).'
}

v5Profile.audience_classification = audienceClassification
console.log('✅ business_model:', audienceClassification.business_model)
console.log('✅ primary_hook:', audienceClassification.primary_hook)
console.log('✅ audience_breadth:', audienceClassification.audience_breadth)

// ============================================================================
// SAVE UPDATED PROFILE
// ============================================================================

console.log('\n💾 Saving updated V5 profile...')

const { error: updateError } = await supabase
  .from('business_brand_profile')
  .update({
    brand_profile_v5: v5Profile,
    updated_at: new Date().toISOString()
  })
  .eq('business_id', CAFE_FAUST_ID)

if (updateError) {
  console.error('❌ Error updating V5 profile:', updateError)
  Deno.exit(1)
}

console.log('✅ V5 profile updated successfully!')

// ============================================================================
// VERIFICATION
// ============================================================================

console.log('\n🔍 Verification:')
console.log('─────────────────────────────────────────')

const { data: updated } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const v5 = (updated?.brand_profile_v5 as any)

console.log('Identity extensions:', {
  business_description: v5?.identity?.business_description ? '✅' : '❌',
  category_keywords: v5?.identity?.category_keywords?.length || 0
})

console.log('Voice extensions:', {
  avoid_examples: v5?.voice?.avoid_examples?.length || 0,
  register_guidance: v5?.voice?.register_guidance ? '✅' : '❌'
})

console.log('Writing examples extensions:', {
  do_say_examples: v5?.writing_examples?.do_say_examples?.length || 0,
  prefer_vocabulary: v5?.writing_examples?.prefer_vocabulary?.length || 0,
  avoid_vocabulary: v5?.writing_examples?.avoid_vocabulary?.length || 0
})

console.log('Audience classification:', {
  business_model: v5?.audience_classification?.business_model || '❌',
  primary_hook: v5?.audience_classification?.primary_hook || '❌',
  audience_breadth: v5?.audience_classification?.audience_breadth || '❌'
})

console.log('\n🎉 Migration Complete!')
console.log('✅ 10 new fields added to V5 Brand Profile')
console.log('✅ Phase 3 will now read from V5 JSONB first, legacy columns second')
console.log('✅ Backward compatibility maintained via fallback chains')
