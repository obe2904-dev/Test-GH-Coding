/**
 * Check Café Faust V5 Profile Completeness for Dagens Forslag
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking Café Faust V5 Profile for Dagens Forslag Fields\n')

const { data: profile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const v5 = (profile?.brand_profile_v5 as any)

// Fields needed for Dagens Forslag (from assessment)
const requiredFields: Record<string, any> = {
  'identity.brand_essence': v5?.identity?.brand_essence,
  'identity.business_description': v5?.identity?.business_description,
  'identity.category_keywords': v5?.identity?.category_keywords,
  'identity.what_makes_us_different': v5?.identity?.what_makes_us_different,
  'identity.positioning': v5?.identity?.positioning,
  'voice.content_anchors': v5?.voice?.content_anchors,
  'voice.avoid_examples': v5?.voice?.avoid_examples,
  'voice.tone_rules': v5?.voice?.tone_rules,
  'voice.personality_traits': v5?.voice?.personality_traits,
  'voice.humor_style': v5?.voice?.humor_style,
  'voice.register_guidance': v5?.voice?.register_guidance,
  'writing_examples.typical_openings': v5?.writing_examples?.typical_openings,
  'guardrails.never_say': v5?.guardrails?.never_say,
  'guardrails.content_exclusions': v5?.guardrails?.content_exclusions,
  'programmes[0].target_audience': v5?.programmes?.[0]?.target_audience,
  'programmes[0].communication_objectives': v5?.programmes?.[0]?.communication_objectives,
}

let presentCount = 0
let missingCount = 0

console.log('V5 FIELDS FOR DAGENS FORSLAG:')
console.log('═══════════════════════════════════════════════════════════════\n')

for (const [field, value] of Object.entries(requiredFields)) {
  const hasValue = value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0)
  const status = hasValue ? '✅' : '❌'
  if (hasValue) presentCount++
  else missingCount++
  
  let preview = 'null'
  if (hasValue) {
    if (Array.isArray(value)) {
      preview = `[${value.length} items]`
    } else if (typeof value === 'string') {
      preview = value.substring(0, 40) + (value.length > 40 ? '...' : '')
    } else {
      preview = String(value)
    }
  }
  console.log(`  ${status} ${field}: ${preview}`)
}

console.log(`\n📊 COVERAGE: ${presentCount}/${presentCount + missingCount} fields (${Math.round(presentCount/(presentCount+missingCount)*100)}%)`)

if (missingCount > 0) {
  console.log('\n⚠️  Missing Fields:')
  for (const [field, value] of Object.entries(requiredFields)) {
    const hasValue = value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0)
    if (hasValue === false) {
      console.log(`  - ${field}`)
    }
  }
  console.log('\nThese will fall back to legacy columns (if present)')
} else {
  console.log('\n✅ All required V5 fields present - Dagens Forslag ready for V5!')
}
