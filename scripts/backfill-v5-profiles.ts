/**
 * Phase 3: Backfill V5 Profiles
 * 
 * Migrates existing business data from legacy columns + business_programme_profiles
 * into the new brand_profile_v5 JSONB column.
 * 
 * Strategy:
 * 1. Read existing data from legacy columns (tone_of_voice, typical_openings, etc.)
 * 2. Read existing programme data from business_programme_profiles
 * 3. AI-generate missing pieces (e.g., typical_closings if empty, guardrails)
 * 4. Assemble complete V5 JSONB structure
 * 5. Save to brand_profile_v5 column
 * 
 * @usage: deno run --allow-net --allow-env backfill-v5-profiles.ts
 * @version 5.0
 * @date May 9, 2026
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { V5BrandProfile, V5Programme, V5Identity, V5Voice, V5WritingExamples, V5Guardrails } from '../supabase/functions/_shared/brand-profile/types-v5.ts'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.com'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

if (!SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('❌ Missing environment variables: SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Main backfill function
 */
async function backfillV5Profiles() {
  console.log('🔄 Starting V5 Profile Backfill...\n')
  
  // 1. Get all businesses that need backfill
  const { data: businesses, error } = await supabase
    .from('business_brand_profile')
    .select('business_id, business_name')
    .is('brand_profile_v5', null) // Only businesses without V5 profile
  
  if (error) {
    console.error('❌ Failed to fetch businesses:', error)
    return
  }
  
  if (!businesses || businesses.length === 0) {
    console.log('✅ No businesses need backfill (all have V5 profiles)')
    return
  }
  
  console.log(`📊 Found ${businesses.length} businesses to backfill:\n`)
  businesses.forEach(b => console.log(`  - ${b.business_name} (${b.business_id})`))
  console.log('')
  
  // 2. Backfill each business
  let successCount = 0
  let failCount = 0
  
  for (const business of businesses) {
    try {
      console.log(`\n🔧 Backfilling: ${business.business_name}...`)
      await backfillSingleBusiness(business.business_id)
      successCount++
      console.log(`✅ Success: ${business.business_name}`)
    } catch (error) {
      failCount++
      console.error(`❌ Failed: ${business.business_name}`, error)
    }
  }
  
  // 3. Summary
  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`📊 Total: ${businesses.length}`)
  console.log('')
}

/**
 * Backfill single business
 */
async function backfillSingleBusiness(businessId: string) {
  const startTime = Date.now()
  
  // 1. Fetch existing data
  const { data: businessData, error: fetchError } = await supabase
    .from('business_brand_profile')
    .select(`
      business_id,
      business_name,
      business_category,
      establishment_type,
      brand_essence,
      positioning,
      core_values,
      tone_of_voice,
      tone_keywords,
      tone_model,
      typical_openings,
      typical_closings,
      signature_phrases,
      never_say,
      things_to_avoid,
      voice_constraints
    `)
    .eq('business_id', businessId)
    .single()
  
  if (fetchError || !businessData) {
    throw new Error(`Failed to fetch business data: ${fetchError?.message}`)
  }
  
  // 2. Fetch programme profiles
  const { data: programmeData, error: programmeError } = await supabase
    .from('business_programme_profiles')
    .select('*')
    .eq('business_id', businessId)
  
  if (programmeError) {
    console.warn(`  ⚠️ No programme data found (will skip programmes)`)
  }
  
  // 3. Build V5 structure
  const v5Profile: V5BrandProfile = {
    version: '5.0',
    generated_at: new Date().toISOString(),
    generation_metadata: {
      request_id: crypto.randomUUID(),
      duration_ms: 0, // Will update at end
      ai_models_used: {
        layer_5: 'gpt-4o' // Only Layer 5 might use AI in backfill
      }
    },
    programmes: programmeData ? await buildProgrammes(programmeData) : [],
    identity: buildIdentity(businessData),
    voice: await buildVoice(businessData),
    writing_examples: await buildWritingExamples(businessData),
    guardrails: await buildGuardrails(businessData)
  }
  
  v5Profile.generation_metadata!.duration_ms = Date.now() - startTime
  
  // 4. Save to database
  const { error: saveError } = await supabase
    .from('business_brand_profile')
    .update({
      brand_profile_v5: v5Profile,
      brand_profile_v5_generated_at: v5Profile.generated_at,
      brand_profile_v5_version: v5Profile.version
    })
    .eq('business_id', businessId)
  
  if (saveError) {
    throw new Error(`Failed to save V5 profile: ${saveError.message}`)
  }
  
  console.log(`  ✅ Saved V5 profile (${Date.now() - startTime}ms)`)
}

/**
 * Build programmes array from business_programme_profiles
 */
async function buildProgrammes(programmeData: any[]): Promise<V5Programme[]> {
  return programmeData.map(p => ({
    type: p.programme_type,
    name: p.programme_name,
    timeWindow: p.time_window || { start: '00:00', end: '23:59' },
    daysOfWeek: p.days_of_week || [],
    confidence: p.confidence || 'medium',
    menuEvidence: p.menu_evidence || [],
    commercialOrientation: p.commercial_orientation || {
      decision_timing: 'mixed',
      baseline_goal_split: {
        drive_footfall: 40,
        strengthen_brand: 40,
        retain_regulars: 20
      },
      reasoning: 'Migrated from legacy data'
    },
    audienceSegments: p.audience_segments || []
  }))
}

/**
 * Build identity from legacy columns
 */
function buildIdentity(data: any): V5Identity {
  return {
    brand_essence: data.brand_essence || 'Not yet defined',
    positioning: data.positioning || 'Not yet defined',
    core_values: data.core_values || [],
    what_makes_us_different: 'Not yet defined',
    identity_confidence: data.brand_essence ? 0.7 : 0.3,
    identity_reasoning: 'Migrated from legacy brand_essence/positioning/core_values columns',
    identity_sources: []
  }
}

/**
 * Build voice from legacy tone_of_voice
 */
async function buildVoice(data: any): Promise<V5Voice> {
  // If tone_of_voice exists, parse it
  if (data.tone_of_voice) {
    const parsed = parseLegacyToneOfVoice(data.tone_of_voice)
    
    if (parsed.tone_rules.length >= 3) {
      console.log('  ✅ Voice parsed from legacy tone_of_voice')
      return {
        tone_rules: parsed.tone_rules,
        personality_traits: parsed.personality_traits || ['venlig', 'professionel'],
        formality_level: parsed.formality_level || 'informal',
        humor_style: parsed.humor_style || 'none',
        sentence_structure: parsed.sentence_structure || 'conversational',
        voice_confidence: 0.75,
        voice_reasoning: 'Parsed from legacy tone_of_voice field'
      }
    }
  }
  
  // Otherwise, create basic voice
  console.log('  ℹ️ Creating basic voice (no legacy tone_of_voice)')
  return {
    tone_rules: [
      'Skriv klart og konkret',
      'Tal direkte til gæsten',
      'Fokuser på det væsentlige'
    ],
    personality_traits: data.tone_keywords || ['venlig', 'professionel'],
    formality_level: 'informal',
    humor_style: 'none',
    sentence_structure: 'conversational',
    voice_confidence: 0.5,
    voice_reasoning: 'Basic voice created (no legacy data available)'
  }
}

/**
 * Parse legacy tone_of_voice text
 */
function parseLegacyToneOfVoice(toneOfVoice: string): Partial<V5Voice> {
  const lines = toneOfVoice.split('\n').map(l => l.trim()).filter(Boolean)
  const tone_rules: string[] = []
  const personality_traits: string[] = []
  
  for (const line of lines) {
    if (line.startsWith('Eksempel:') || line.includes('STEMME-MEKANIK')) continue
    
    if (line.startsWith('-')) {
      const rule = line.replace(/^-\s*/, '').trim()
      if (rule.length > 10 && !rule.includes(':')) {
        tone_rules.push(rule)
      }
    }
  }
  
  const text = toneOfVoice.toLowerCase()
  if (text.includes('kort') || text.includes('én tanke pr. sætning')) personality_traits.push('kortfattet')
  if (text.includes('direkte')) personality_traits.push('direkte')
  if (text.includes('venlig')) personality_traits.push('venlig')
  if (text.includes('lokal')) personality_traits.push('lokal')
  
  return {
    tone_rules,
    personality_traits,
    formality_level: text.includes('du-form') ? 'informal' : 'semi-formal',
    humor_style: text.includes('tør') ? 'dry' : 'none',
    sentence_structure: text.includes('kort') ? 'short_declarative' : 'conversational'
  }
}

/**
 * Build writing examples from legacy fields
 */
async function buildWritingExamples(data: any): Promise<V5WritingExamples> {
  return {
    typical_openings: data.typical_openings || ['Vi er klar.', 'Kom forbi.', 'Se dagens menu.'],
    typical_closings: data.typical_closings || ['Book dit bord', 'Vi ses', 'Kom forbi'],
    signature_phrases: data.signature_phrases || ['hjemmelavet', 'regionale råvarer']
  }
}

/**
 * Build guardrails from legacy fields
 */
async function buildGuardrails(data: any): Promise<V5Guardrails> {
  return {
    never_say: data.never_say || ['billig → god værdi', 'lækker → (vær specifik)'],
    content_exclusions: [
      'Undgå at nævne konkurrenter direkte',
      'Ingen politiske emner'
    ],
    factual_constraints: [
      'Opfind aldrig events eller arrangementer',
      'Bekræft åbningstider før nævnelse',
      'Verificer menupunkter eksisterer'
    ],
    seasonal_notes: [
      'Undgå terrasse-fokus oktober-marts'
    ]
  }
}

// Run backfill
if (import.meta.main) {
  await backfillV5Profiles()
}
