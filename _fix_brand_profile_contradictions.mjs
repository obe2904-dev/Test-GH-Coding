#!/usr/bin/env node
/**
 * FIX: Brand Profile Contradictions for Café Faust
 * 
 * HIGH PRIORITY:
 * 1. Remove imperative ban from tone_rules (imperatives work fine in examples)
 * 2. Remove "nyd" from banned lists (natural Danish, owner uses it)
 * 3. Clarify "lækker" — allow for dishes, nuance the never_say rule
 * 4. Align formality to "informal" (remove semi-formal conflict)
 * 5. Add writing_examples.good_examples from enhanced_social_examples
 * 
 * MEDIUM PRIORITY:
 * 6. Deduplicate rules (remove style_rules, structural_rules)
 * 7. Consolidate banned words into single deduplicated list
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Fetch current brand profile
const { data: profile, error: fetchError } = await supabase
  .from('business_brand_profile')
  .select('idx, business_id, brand_profile_v5, enhanced_social_examples, voice_guardrails, marketing_manager_brief')
  .eq('business_id', '36e24a84-c32d-4123-910a-1bb2e64d34af')
  .single()

if (fetchError) {
  console.error('❌ Fetch error:', fetchError)
  Deno.exit(1)
}

console.log('✅ Fetched brand profile for Café Faust (idx:', profile.idx, ')')

const v5 = profile.brand_profile_v5
const guardrails = profile.voice_guardrails
const socialExamples = profile.enhanced_social_examples

// ============================================================
// HIGH PRIORITY FIXES
// ============================================================

// FIX 1: Remove imperative ban from tone_rules
console.log('\n🔧 FIX 1: Removing imperative ban from tone_rules...')
const originalToneRules = v5.voice.tone_rules
const fixedToneRules = originalToneRules.filter(rule => 
  !rule.includes('Undgå imperativer som åbning')
)
console.log(`   Removed ${originalToneRules.length - fixedToneRules.length} rule(s)`)
v5.voice.tone_rules = fixedToneRules

// FIX 2: Remove "nyd" from banned lists
console.log('\n🔧 FIX 2: Removing "nyd" from banned lists...')
// Remove from tone_rules generic salgssprog list
const nydRuleIndex = v5.voice.tone_rules.findIndex(r => r.includes('generisk salgssprog') && r.includes('nyd'))
if (nydRuleIndex !== -1) {
  const oldRule = v5.voice.tone_rules[nydRuleIndex]
  const newRule = oldRule.replace(', "nyd"', '').replace('"nyd", ', '')
  v5.voice.tone_rules[nydRuleIndex] = newRule
  console.log('   Removed "nyd" from tone_rules generisk salgssprog')
}

// Remove from voice_guardrails.avoid_patterns.generic_marketing
if (guardrails?.avoid_patterns?.generic_marketing) {
  const original = guardrails.avoid_patterns.generic_marketing
  guardrails.avoid_patterns.generic_marketing = original.filter(phrase => 
    !phrase.toLowerCase().includes('nyd det gode liv')
  )
  console.log(`   Removed ${original.length - guardrails.avoid_patterns.generic_marketing.length} phrase(s) from generic_marketing`)
}

// FIX 3: Clarify "lækker" — update never_say with context
console.log('\n🔧 FIX 3: Clarifying "lækker" usage in never_say...')
if (guardrails?.never_say) {
  const lækkerIndex = guardrails.never_say.findIndex(r => r.includes('lækkert'))
  if (lækkerIndex !== -1) {
    // Change from blanket ban to contextual guidance
    guardrails.never_say[lækkerIndex] = 'lækkert (som abstrakt ros) → (undgå); lækker [ret] (konkret beskrivelse) → OK'
    console.log('   Updated "lækkert" rule with context')
  }
}

// Also remove "lækker" from tone_rules generisk salgssprog
const lækkerRuleIndex = v5.voice.tone_rules.findIndex(r => r.includes('generisk salgssprog') && r.includes('lækker'))
if (lækkerRuleIndex !== -1) {
  const oldRule = v5.voice.tone_rules[lækkerRuleIndex]
  const newRule = oldRule.replace(', "lækker"', '').replace('"lækker", ', '')
  v5.voice.tone_rules[lækkerRuleIndex] = newRule
  console.log('   Removed "lækker" from tone_rules generisk salgssprog')
}

// FIX 4: Align formality to "informal"
console.log('\n🔧 FIX 4: Aligning formality to "informal"...')
if (v5.voice.formality_level === 'informal') {
  console.log('   ✓ V5 already set to "informal"')
} else {
  v5.voice.formality_level = 'informal'
  console.log('   Updated formality_level to "informal"')
}

// Update marketing_manager_brief to remove "semi-formel"
let updatedBrief = profile.marketing_manager_brief
if (updatedBrief.includes('semi-formel')) {
  updatedBrief = updatedBrief.replace('semi-formel og legende', 'casual og legende')
  console.log('   Updated marketing_manager_brief: "semi-formel" → "casual"')
}

// FIX 5: Add writing_examples.good_examples from enhanced_social_examples
console.log('\n🔧 FIX 5: Populating writing_examples.good_examples...')
if (!v5.voice.writing_examples) {
  v5.voice.writing_examples = {}
}

// Extract just the text from enhanced_social_examples
const goodExamples = socialExamples
  .filter(ex => ex.text && ex.text.trim().length > 20)
  .map(ex => ex.text)
  .slice(0, 5) // Top 5 examples

v5.voice.writing_examples.good_examples = goodExamples
console.log(`   Added ${goodExamples.length} good examples to writing_examples.good_examples`)

// ============================================================
// MEDIUM PRIORITY FIXES
// ============================================================

// FIX 6: Deduplicate rules (remove style_rules, structural_rules)
console.log('\n🔧 FIX 6: Removing duplicate rule fields...')
if (v5.voice.style_rules) {
  delete v5.voice.style_rules
  console.log('   Deleted duplicate style_rules')
}
if (v5.voice.structural_rules) {
  delete v5.voice.structural_rules
  console.log('   Deleted duplicate structural_rules')
}

// FIX 7: Consolidate banned words
console.log('\n🔧 FIX 7: Consolidating banned words...')

// Collect all banned words/phrases
const bannedSet = new Set()

// From never_say (extract just the word before →)
if (guardrails?.never_say) {
  guardrails.never_say.forEach(rule => {
    const parts = rule.split('→')
    if (parts[0]) {
      const word = parts[0].trim().replace(/\(.*?\)/g, '').trim()
      if (word && word !== 'OK') bannedSet.add(word)
    }
  })
}

// From avoid_patterns
if (guardrails?.avoid_patterns) {
  const { generic_marketing, superlatives, brochure_language } = guardrails.avoid_patterns
  
  if (generic_marketing) generic_marketing.forEach(p => bannedSet.add(p))
  if (superlatives) superlatives.forEach(p => bannedSet.add(p))
  if (brochure_language) brochure_language.forEach(p => bannedSet.add(p))
}

// Sort and deduplicate
const consolidatedBanned = Array.from(bannedSet).sort()
console.log(`   Consolidated ${consolidatedBanned.length} unique banned words/phrases`)

// Store in a single authoritative location
guardrails.consolidated_banned_vocabulary = consolidatedBanned

// Keep never_say for replacement suggestions, but note it's secondary
console.log('   Kept never_say for replacement guidance (word → better alternative)')

// ============================================================
// WRITE BACK TO DATABASE
// ============================================================

console.log('\n💾 Writing updated profile to database...')

const { error: updateError } = await supabase
  .from('business_brand_profile')
  .update({
    brand_profile_v5: v5,
    voice_guardrails: guardrails,
    marketing_manager_brief: updatedBrief,
    updated_at: new Date().toISOString()
  })
  .eq('idx', profile.idx)

if (updateError) {
  console.error('❌ Update error:', updateError)
  Deno.exit(1)
}

console.log('✅ Brand profile updated successfully!\n')

// ============================================================
// SUMMARY
// ============================================================

console.log('📊 SUMMARY OF CHANGES:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('HIGH PRIORITY:')
console.log('  ✓ Removed imperative ban from tone_rules')
console.log('  ✓ Removed "nyd" from banned lists')
console.log('  ✓ Clarified "lækker" usage (context-aware)')
console.log('  ✓ Aligned formality to "informal" (removed semi-formel)')
console.log(`  ✓ Added ${goodExamples.length} writing examples to good_examples field`)
console.log('\nMEDIUM PRIORITY:')
console.log('  ✓ Removed duplicate style_rules and structural_rules')
console.log(`  ✓ Consolidated ${consolidatedBanned.length} banned words into single list`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('🎯 Next: Test generate-text-from-idea to verify consistency')
console.log('   The contradictions should now be resolved.\n')
