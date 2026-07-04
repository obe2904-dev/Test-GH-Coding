#!/usr/bin/env node
/**
 * Test V5.3 Multi-Language Support
 * Tests that customer situations and marketing brief are in Danish (for Danish business)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'

// Load environment variables
const env = config({ path: '.env.local' })

const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or ANON_KEY in .env.local')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false }
})

console.log('═══════════════════════════════════════════════════════════════')
console.log('  V5.3 MULTI-LANGUAGE VERIFICATION')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Business ID: ${BUSINESS_ID}`)
console.log('')

// Test 1: Marketing Manager Brief Language
console.log('─── Test 1: Marketing Manager Brief Language ───')
const { data: profiles, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, marketing_manager_brief, brand_profile_v5')
  .eq('business_id', BUSINESS_ID)

if (profileError) {
  console.log(`❌ Failed to fetch profile: ${profileError.message}`)
} else if (profiles && profiles.length > 0) {
  const profile = profiles[0]
  
  if (profile.marketing_manager_brief) {
    const brief = profile.marketing_manager_brief
    const briefLength = brief.length
    const preview = brief.substring(0, 200)
    
    // Check for English vs Danish
    const hasEnglish = /lunch break|working lunch|quick bite|after-work drinks/i.test(brief)
    const hasDanish = /frokostpause|arbejdsfrokost|hurtig frokost|efter arbejde/i.test(brief)
    
    const languageResult = hasDanish && !hasEnglish ? '✅ DANISH' : 
                          hasEnglish && !hasDanish ? '❌ ENGLISH' : 
                          hasEnglish && hasDanish ? '⚠️  MIXED (Danish + English)' : 
                          '❓ Unknown'
    
    console.log(`   Length: ${briefLength} chars`)
    console.log(`   Language: ${languageResult}`)
    console.log(`   Preview: ${preview}...`)
  } else {
    console.log('❌ No marketing_manager_brief found')
  }
  
  // Test 2: USPs in brand_profile_v5
  console.log('')
  console.log('─── Test 2: USP Extraction ───')
  if (profile?.brand_profile_v5?.layer_0_intelligence?.usps) {
    const usps = profile.brand_profile_v5.layer_0_intelligence.usps
    console.log(`✅ Primary USP: "${usps.primary_usp.text}" (score: ${usps.primary_usp.score})`)
    console.log(`   Secondary USPs: ${usps.secondary_usps.length} found`)
    usps.secondary_usps.forEach((usp, idx) => {
      console.log(`   ${idx + 1}. "${usp.text}" (score: ${usp.score})`)
    })
  } else {
    console.log('❌ USPs not found in brand_profile_v5')
  }
} else {
  console.log('❌ No business_brand_profile found')
}

console.log('')

// Test 3: Customer Situations Language
console.log('─── Test 3: Customer Situations Language ───')
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, audience_segments')
  .eq('business_id', BUSINESS_ID)

if (progError) {
  console.log(`❌ Failed to fetch programmes: ${progError.message}`)
} else if (programmes && programmes.length > 0) {
  let allDanish = true
  let allEnglish = true
  
  for (const prog of programmes) {
    if (prog.audience_segments && Array.isArray(prog.audience_segments)) {
      for (const segment of prog.audience_segments) {
        if (segment.situations && Array.isArray(segment.situations)) {
          console.log(`   ${prog.programme_type} → ${segment.segment_name}:`)
          console.log(`   Situations: ${JSON.stringify(segment.situations)}`)
          
          const situations = segment.situations.join(' ')
          const hasDanishSituations = /frokostpause|arbejdsfrokost|hurtig frokost|weekend|fejring|date|efter arbejde/i.test(situations)
          const hasEnglishSituations = /lunch break|working lunch|quick bite|weekend|celebration|date night|after-work/i.test(situations)
          
          if (!hasDanishSituations) allDanish = false
          if (!hasEnglishSituations) allEnglish = false
          
          const langCheck = hasDanishSituations && !hasEnglishSituations ? '✅ Danish' :
                           hasEnglishSituations && !hasDanishSituations ? '❌ English' :
                           hasEnglishSituations && hasDanishSituations ? '⚠️  Mixed' :
                           '❓ Unknown'
          console.log(`   Language: ${langCheck}`)
          console.log('')
        }
      }
    }
  }
  
  const finalResult = allDanish && !allEnglish ? '✅ ALL SITUATIONS IN DANISH' :
                     allEnglish && !allDanish ? '❌ ALL SITUATIONS IN ENGLISH' :
                     '⚠️  MIXED LANGUAGES DETECTED'
  console.log(`   Overall: ${finalResult}`)
} else {
  console.log('❌ No programmes found')
}

console.log('')
console.log('═══════════════════════════════════════════════════════════════')
console.log('  VERIFICATION COMPLETE')
console.log('═══════════════════════════════════════════════════════════════')
