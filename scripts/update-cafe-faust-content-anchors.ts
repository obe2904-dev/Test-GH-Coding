/**
 * Update Café Faust V5 Profile - Add content_anchors
 * 
 * Adds content_anchors to voice section of brand_profile_v5 JSONB
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔄 Fetching Café Faust V5 profile...')

// 1. Get current V5 profile
const { data: current, error: fetchError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, tone_model')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (fetchError || !current?.brand_profile_v5) {
  console.error('❌ Error fetching V5 profile:', fetchError)
  Deno.exit(1)
}

const v5Profile = current.brand_profile_v5 as any

console.log('\n📋 Current V5 Voice:')
console.log('  content_anchors:', v5Profile.voice?.content_anchors || '❌ MISSING')

// Check legacy tone_model for reference
const legacyAnchors = (current.tone_model as any)?.content_anchors
console.log('\n📦 Legacy tone_model.content_anchors:', legacyAnchors || '❌ none')

// 2. Determine content_anchors for Café Faust
// Based on V5 identity: "alsidig café ved åen, der tilbyder en bred vifte af brunch, frokost og aftensmad"
// Plus bar service (open until 02:00 Friday-Saturday)
const contentAnchors = [
  "Brunch",
  "Frokost",
  "Aftensmad",
  "Bar",
  "Kaffe",
  "Drinks",
  "À la carte"
]

console.log('\n✨ Adding content anchors:')
console.log('  ', contentAnchors.join(', '))
console.log('\n💡 Purpose: Prevents AI hallucination of non-existent dishes/services')
console.log('   Example: Won\'t say "Kom til vores morgenkaffe kl. 07:00" (opens 09:30)')

// 3. Update voice section
if (!v5Profile.voice) {
  console.error('❌ No voice section in V5 profile')
  Deno.exit(1)
}

v5Profile.voice.content_anchors = contentAnchors

// 4. Save updated profile
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

console.log('\n✅ V5 profile updated successfully!')

// 5. Verify update
const { data: updated } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const updatedVoice = (updated?.brand_profile_v5 as any)?.voice

console.log('\n🔍 Verification:')
console.log('  content_anchors:', updatedVoice?.content_anchors)
console.log('\n✅ Migration complete! Phase 3 will now read content_anchors from V5.')
console.log('✅ Prevents hallucination: AI can only mention these programme types')
