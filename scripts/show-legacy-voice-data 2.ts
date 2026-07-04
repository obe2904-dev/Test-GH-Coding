#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --env-file=.env

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const s = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const { data } = await s
  .from('business_brand_profile')
  .select('tone_of_voice, typical_openings, typical_closings, never_say, signature_phrases')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .single()

console.log('📦 LEGACY DATA (Still in Separate Columns):\n')

if (data.tone_of_voice) {
  console.log(`✓ tone_of_voice: "${data.tone_of_voice.slice(0, 100)}..."`)
}
if (data.typical_openings?.length) {
  console.log(`✓ typical_openings (${data.typical_openings.length}):`)
  data.typical_openings.forEach((o: string) => console.log(`  - "${o}"`))
}
if (data.typical_closings?.length) {
  console.log(`✓ typical_closings (${data.typical_closings.length}):`)
  data.typical_closings.forEach((c: string) => console.log(`  - "${c}"`))
}
if (data.never_say?.length) {
  console.log(`✓ never_say: ${data.never_say.length} rules`)
}
if (data.signature_phrases?.length) {
  console.log(`✓ signature_phrases (${data.signature_phrases.length}):`)
  data.signature_phrases.forEach((p: string) => console.log(`  - "${p}"`))
}

console.log('\n❌ NOT YET IN V5 STRUCTURE (Phases 1-5 not implemented)')
console.log('   V5 currently only has: programmes, commercialOrientation, identity, audienceSegments')
console.log('   Missing: voice, writing_examples, guardrails')
