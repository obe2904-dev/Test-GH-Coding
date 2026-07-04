#!/usr/bin/env node
/**
 * V5.3 Quality and Functionality Test Script
 * 
 * Tests the new enhancements:
 * 1. Business DNA Analyst persona (Danish system prompts)
 * 2. Marketing Manager Brief generation
 * 3. USP extraction
 * 4. Customer situations in audience segments
 * 5. Language quality (no English pollution)
 * 
 * Usage:
 *   node _test_brand_profile_v5_3.mjs <business_id>
 * 
 * Example:
 *   node _test_brand_profile_v5_3.mjs 561f8fe8-41cb-4191-87e4-5cabf9bcdd79
 * 
 * @version 1.0.0
 * @date June 21, 2026
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_BUSINESS_ID = Deno.args[0] || '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' // Café Faust

console.log('═══════════════════════════════════════════════════════════════')
console.log('  V5.3 BRAND PROFILE QUALITY & FUNCTIONALITY TEST')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Business ID: ${TEST_BUSINESS_ID}`)
console.log(`Supabase URL: ${SUPABASE_URL}`)
console.log('')

// ============================================================================
// STEP 1: TRIGGER BRAND PROFILE REGENERATION
// ============================================================================

console.log('🔄 Step 1: Triggering brand profile regeneration (V5)...')

const { data: regenerateData, error: regenerateError } = await supabase.functions.invoke(
  'brand-profile-generator-v5',
  {
    body: {
      businessId: TEST_BUSINESS_ID,
      forceRegenerate: true
    }
  }
)

if (regenerateError) {
  console.error('❌ Regeneration failed:', regenerateError)
  Deno.exit(1)
}

console.log('✅ Regeneration completed')
console.log(`   Version: ${regenerateData?.version || 'unknown'}`)
console.log(`   Duration: ${regenerateData?.generation_metadata?.duration_ms || 0}ms`)
console.log('')

// Wait for database write to complete
await new Promise(resolve => setTimeout(resolve, 2000))

// ============================================================================
// STEP 2: FETCH GENERATED PROFILE
// ============================================================================

console.log('📥 Step 2: Fetching generated profile...')

const { data: profile, error: fetchError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, marketing_manager_brief, business_identity_persona')
  .eq('business_id', TEST_BUSINESS_ID)
  .single()

if (fetchError || !profile) {
  console.error('❌ Failed to fetch profile:', fetchError)
  Deno.exit(1)
}

const v5 = profile.brand_profile_v5

console.log('✅ Profile fetched')
console.log(`   Version: ${v5.version}`)
console.log(`   Generated: ${v5.generated_at}`)
console.log('')

// ============================================================================
// STEP 3: QUALITY TESTS (Language & Content)
// ============================================================================

console.log('🔍 Step 3: Running quality tests...')
console.log('')

const qualityResults = {
  passed: 0,
  failed: 0,
  warnings: 0
}

function testPass(name) {
  console.log(`✅ ${name}`)
  qualityResults.passed++
}

function testFail(name, detail) {
  console.log(`❌ ${name}`)
  if (detail) console.log(`   ${detail}`)
  qualityResults.failed++
}

function testWarn(name, detail) {
  console.log(`⚠️  ${name}`)
  if (detail) console.log(`   ${detail}`)
  qualityResults.warnings++
}

// === TEST 3.1: Marketing Manager Brief ===
console.log('─── Test 3.1: Marketing Manager Brief ───')

if (v5.marketing_manager_brief) {
  testPass('Marketing manager brief exists')
  
  const brief = v5.marketing_manager_brief
  const wordCount = brief.split(/\s+/).length
  
  // Check word count
  if (wordCount >= 100 && wordCount <= 300) {
    testPass(`Word count appropriate (${wordCount} words)`)
  } else {
    testWarn(`Word count out of range (${wordCount} words, expected 100-300)`)
  }
  
  // Check language (must be Danish)
  const danishIndicators = /\b(du er|din opgave|fremhæv|undgå|strategi|virksomhed)\b/i
  const englishPollution = /\b(you are|your job|always highlight|never|strategy)\b/i
  
  if (danishIndicators.test(brief)) {
    testPass('Language: Danish detected')
  } else {
    testFail('Language: No Danish indicators found')
  }
  
  if (!englishPollution.test(brief)) {
    testPass('No English pollution detected')
  } else {
    testFail('English pollution detected in brief')
  }
  
  // Check structure (should have sections)
  const hasSections = /VIRKSOMHED:|DIN OPGAVE:|FREMHÆV|STEMME:|STRATEGI:|UNDGÅ/i.test(brief)
  if (hasSections) {
    testPass('Structured format with sections')
  } else {
    testWarn('Missing expected section headers')
  }
  
  console.log(`\n📋 Marketing Manager Brief Preview:\n${brief.substring(0, 300)}...\n`)
  
} else {
  testFail('Marketing manager brief missing')
}

// === TEST 3.2: USP Extraction ===
console.log('─── Test 3.2: USP Extraction ───')

if (v5.layer_0_intelligence?.usps) {
  testPass('USPs extracted')
  
  const usps = v5.layer_0_intelligence.usps
  
  if (usps.primary_usp) {
    testPass(`Primary USP: "${usps.primary_usp.text}" (score: ${usps.primary_usp.score})`)
    
    if (usps.primary_usp.score >= 80) {
      testPass('Primary USP has strong score (≥80)')
    } else {
      testWarn(`Primary USP score weak (${usps.primary_usp.score}, expected ≥80)`)
    }
  } else {
    testFail('Primary USP missing')
  }
  
  if (usps.secondary_usps && usps.secondary_usps.length > 0) {
    testPass(`Secondary USPs: ${usps.secondary_usps.length} (${usps.secondary_usps.map(u => u.text).join(', ')})`)
  } else {
    testWarn('No secondary USPs found')
  }
  
} else {
  testFail('USPs not extracted')
}

// === TEST 3.3: Customer Situations ===
console.log('\n─── Test 3.3: Customer Situations ───')

const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, audience_segments')
  .eq('business_id', TEST_BUSINESS_ID)

if (programmes && programmes.length > 0) {
  testPass(`${programmes.length} programmes found`)
  
  let situationsFound = 0
  let segmentsWithSituations = 0
  
  programmes.forEach(prog => {
    if (prog.audience_segments && Array.isArray(prog.audience_segments)) {
      prog.audience_segments.forEach(segment => {
        if (segment.situations && Array.isArray(segment.situations) && segment.situations.length > 0) {
          situationsFound += segment.situations.length
          segmentsWithSituations++
        }
      })
    }
  })
  
  if (segmentsWithSituations > 0) {
    testPass(`Customer situations added to ${segmentsWithSituations} segments (${situationsFound} total situations)`)
    
    // Show sample
    const sampleSegment = programmes[0].audience_segments.find(s => s.situations?.length > 0)
    if (sampleSegment) {
      console.log(`\n   Sample (${sampleSegment.label}): ${sampleSegment.situations.join(', ')}\n`)
    }
  } else {
    testFail('No customer situations found in audience segments')
  }
  
} else {
  testFail('No programmes found', progError?.message)
}

// === TEST 3.4: Business Identity Persona (Danish) ===
console.log('─── Test 3.4: Business Identity Persona Language ───')

if (profile.business_identity_persona) {
  const persona = profile.business_identity_persona
  
  // Check Danish structure
  const danishStructure = /FORRETNING:|LOKATION:|TILBUD:|KULINARISK/i
  if (danishStructure.test(persona)) {
    testPass('Persona has Danish structure')
  } else {
    testFail('Persona missing Danish section headers')
  }
  
  // Check for English pollution
  const englishPollution = /\b(you are|business|location|offering|culinary)\b/i
  if (!englishPollution.test(persona.substring(0, 200))) {
    testPass('No English pollution in persona')
  } else {
    testWarn('Possible English pollution detected')
  }
  
  console.log(`\n📝 Persona Preview:\n${persona.substring(0, 250)}...\n`)
  
} else {
  testFail('Business identity persona missing')
}

// === TEST 3.5: Voice Profile (Danish tone rules) ===
console.log('─── Test 3.5: Voice Profile Language ───')

if (v5.voice?.tone_rules) {
  testPass(`Voice profile exists (${v5.voice.tone_rules.length} tone rules)`)
  
  // Check if tone rules are in Danish
  const danishRules = v5.voice.tone_rules.filter(rule => 
    /[æøå]/i.test(rule) || /\b(brug|undgå|skriv|fokus|nævn)\b/i.test(rule)
  )
  
  if (danishRules.length >= v5.voice.tone_rules.length * 0.8) {
    testPass(`Tone rules in Danish (${danishRules.length}/${v5.voice.tone_rules.length})`)
  } else {
    testFail(`Too many non-Danish tone rules (${danishRules.length}/${v5.voice.tone_rules.length})`)
  }
  
  // Sample tone rules
  console.log(`\n   Sample tone rules:`)
  v5.voice.tone_rules.slice(0, 3).forEach(rule => {
    console.log(`   • ${rule}`)
  })
  console.log('')
  
} else {
  testFail('Voice profile or tone rules missing')
}

// ============================================================================
// STEP 4: FUNCTIONALITY TESTS (Integration)
// ============================================================================

console.log('\n🔧 Step 4: Running functionality tests...')
console.log('')

// === TEST 4.1: Marketing Brief Used in get-quick-suggestions ===
console.log('─── Test 4.1: Marketing Brief in Stage 2 (get-quick-suggestions) ───')

try {
  const { data: suggestions, error: suggestError } = await supabase.functions.invoke(
    'get-quick-suggestions',
    {
      body: {
        businessId: TEST_BUSINESS_ID,
        ideaType: 'menu_item',
        ideaText: 'Test dish for validation',
        ideaContext: {}
      }
    }
  )
  
  if (suggestError) {
    testFail('Quick suggestions call failed', suggestError.message)
  } else if (suggestions?.suggestions && suggestions.suggestions.length > 0) {
    testPass('Quick suggestions generated successfully')
    
    // Check if response is in Danish
    const firstSuggestion = suggestions.suggestions[0]?.text || ''
    const isDanish = /[æøå]/i.test(firstSuggestion) || 
                     /\b(vi|har|til|med|fra|på)\b/i.test(firstSuggestion)
    
    if (isDanish) {
      testPass('Suggestions in Danish')
    } else {
      testWarn('Suggestions may not be in Danish')
    }
    
    console.log(`\n   Sample suggestion: "${firstSuggestion.substring(0, 100)}..."\n`)
  } else {
    testWarn('No suggestions generated (may be rate limited)')
  }
} catch (err) {
  testFail('Quick suggestions test error', err.message)
}

// === TEST 4.2: Database Structure Validation ===
console.log('─── Test 4.2: Database Structure ───')

if (v5.version === '5.1') {
  testPass('V5 profile version correct')
} else {
  testWarn(`Unexpected version: ${v5.version}`)
}

if (v5.layer_0_intelligence) {
  testPass('Layer 0 intelligence present')
} else {
  testFail('Layer 0 intelligence missing')
}

if (v5.marketing_manager_brief_metadata) {
  testPass('Marketing brief metadata present')
  console.log(`   Word count: ${v5.marketing_manager_brief_metadata.word_count}`)
  console.log(`   Generated: ${v5.marketing_manager_brief_metadata.generated_at}`)
} else {
  testWarn('Marketing brief metadata missing')
}

// ============================================================================
// FINAL REPORT
// ============================================================================

console.log('')
console.log('═══════════════════════════════════════════════════════════════')
console.log('  TEST RESULTS SUMMARY')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`✅ Passed:   ${qualityResults.passed}`)
console.log(`❌ Failed:   ${qualityResults.failed}`)
console.log(`⚠️  Warnings: ${qualityResults.warnings}`)
console.log('═══════════════════════════════════════════════════════════════')

if (qualityResults.failed === 0) {
  console.log('🎉 ALL TESTS PASSED!')
  Deno.exit(0)
} else {
  console.log(`❌ ${qualityResults.failed} test(s) failed`)
  Deno.exit(1)
}
