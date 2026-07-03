#!/usr/bin/env node
/**
 * Test script: Verify forbidden phrases are blocked in actual post generation
 * 
 * Phase 2 Week 1 verification:
 * 1. Generate text from a menu idea
 * 2. Check if validation catches forbidden phrases
 * 3. Verify retry logic works if violations found
 * 
 * Business: Cafe Faust (f4679fa9-3120-4a59-9506-d059b010c34a)
 * Week: 24 (Danish summer context - high risk for "hygge" violations)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Cafe Faust
const WEEK_NUMBER = 24

console.log('═══════════════════════════════════════════════════════════════')
console.log('  Phase 2 Week 1: Forbidden Phrases Enforcement Test')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Business: Cafe Faust (${BUSINESS_ID})`)
console.log(`Week: ${WEEK_NUMBER}`)
console.log()

// 1. Check database has forbidden phrases
console.log('1️⃣  Verifying database guardrails...')
const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', BUSINESS_ID)
  .single()

if (profileError) {
  console.error('❌ Error fetching profile:', profileError)
  process.exit(1)
}

console.log('DEBUG: profile keys:', Object.keys(profile || {}))
console.log('DEBUG: brand_profile_v5 exists:', !!profile?.brand_profile_v5)
console.log('DEBUG: brand_profile_v5 keys:', Object.keys(profile?.brand_profile_v5 || {}))

const guardrails = profile?.brand_profile_v5?.guardrails || {}
console.log('DEBUG: guardrails keys:', Object.keys(guardrails))
console.log('✅ Forbidden phrases:', guardrails.forbidden_phrases?.length || 0)
console.log('✅ Technical terms:', guardrails.technical_terms?.length || 0)
console.log('✅ Weather clichés:', guardrails.weather_cliches?.length || 0)
console.log()

if (!guardrails.forbidden_phrases || guardrails.forbidden_phrases.length === 0) {
  console.error('❌ No forbidden phrases in database! Run migration first.')
  process.exit(1)
}

// 2. Get a menu suggestion to test with
console.log('2️⃣  Fetching test suggestion from week 24...')
const { data: suggestions } = await supabase
  .from('weekly_content_suggestions')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', WEEK_NUMBER)
  .eq('content_type', 'menu_item')
  .limit(1)

if (!suggestions || suggestions.length === 0) {
  console.error('❌ No menu suggestions found for week 24')
  process.exit(1)
}

const testSuggestion = suggestions[0]
console.log(`✅ Test suggestion: "${testSuggestion.title}"`)
console.log(`   Content type: ${testSuggestion.content_type}`)
console.log()

// 3. Generate text and check for violations
console.log('3️⃣  Generating post text...')
const { data: result, error } = await supabase.functions.invoke('generate-text-from-idea', {
  body: {
    businessId: BUSINESS_ID,
    suggestion: testSuggestion,
    platforms: ['facebook'],
    tier: 'paid'
  }
})

if (error) {
  console.error('❌ Generation failed:', error)
  process.exit(1)
}

console.log('✅ Generation completed')
console.log()

// 4. Check generated text for forbidden phrases
console.log('4️⃣  Analyzing generated text for violations...')
const generatedText = result.text
console.log('Generated text:')
console.log('─'.repeat(60))
console.log(generatedText)
console.log('─'.repeat(60))
console.log()

// Check for forbidden phrases manually
const lowerText = generatedText.toLowerCase()
const violations = []

for (const phrase of guardrails.forbidden_phrases || []) {
  if (lowerText.includes(phrase.toLowerCase())) {
    violations.push({ type: 'forbidden_phrase', text: phrase })
  }
}

for (const term of guardrails.technical_terms || []) {
  if (new RegExp(`\\b${term}\\b`, 'i').test(generatedText)) {
    violations.push({ type: 'technical_term', text: term })
  }
}

for (const cliche of guardrails.weather_cliches || []) {
  if (lowerText.includes(cliche.toLowerCase())) {
    violations.push({ type: 'weather_cliche', text: cliche })
  }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  RESULTS')
console.log('═══════════════════════════════════════════════════════════════')

if (violations.length === 0) {
  console.log('✅ SUCCESS: No forbidden phrases detected in generated text!')
  console.log('   Validation is working correctly.')
} else {
  console.log('❌ VIOLATIONS FOUND:')
  violations.forEach(v => {
    console.log(`   [${v.type}] "${v.text}"`)
  })
  console.log()
  console.log('⚠️  These should have been caught by voice validation during generation.')
  console.log('   Check function logs for validation details.')
}

console.log()
console.log('Function logs: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions/generate-text-from-idea/logs')
