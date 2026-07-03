/**
 * V5 Profile Reader Service
 * 
 * Provides clean, simple functions for reading brand profile data from
 * the brand_profile_v5 JSONB column.
 * 
 * This service is the ONLY way consumers should access brand profile data.
 * No direct column queries after V5 migration.
 * 
 * @version 5.0
 * @date May 9, 2026
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { 
  V5BrandProfile, 
  V5Programme, 
  V5Identity, 
  V5Voice, 
  V5WritingExamples, 
  V5Guardrails 
} from './brand-profile/types-v5.ts'

// ============================================================================
// CORE READER - Get Complete Profile
// ============================================================================

/**
 * Get complete V5 brand profile for a business
 * 
 * @returns Complete V5 profile or null if not generated
 */
export async function getV5Profile(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5BrandProfile | null> {
  
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', businessId)
    .single()
  
  if (error) {
    console.error('❌ Failed to fetch V5 profile:', error)
    return null
  }
  
  return data?.brand_profile_v5 || null
}

// ============================================================================
// LAYER-SPECIFIC READERS
// ============================================================================

/**
 * Get programmes (Layer 1-2-4 combined)
 */
export async function getV5Programmes(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5Programme[]> {
  
  const profile = await getV5Profile(supabase, businessId)
  return profile?.programmes || []
}

/**
 * Get brand identity (Layer 3)
 */
export async function getV5Identity(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5Identity | null> {
  
  const profile = await getV5Profile(supabase, businessId)
  return profile?.identity || null
}

/**
 * Get voice profile (Layer 5a)
 */
export async function getV5Voice(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5Voice | null> {
  
  const profile = await getV5Profile(supabase, businessId)
  return profile?.voice || null
}

/**
 * Get writing examples (Layer 5b)
 */
export async function getV5WritingExamples(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5WritingExamples | null> {
  
  const profile = await getV5Profile(supabase, businessId)
  return profile?.writing_examples || null
}

/**
 * Get guardrails (Layer 5c)
 */
export async function getV5Guardrails(
  supabase: SupabaseClient,
  businessId: string
): Promise<V5Guardrails | null> {
  
  const profile = await getV5Profile(supabase, businessId)
  return profile?.guardrails || null
}

// ============================================================================
// CONVENIENCE HELPERS - For Common Use Cases
// ============================================================================

/**
 * Get tone rules (most common voice query)
 * 
 * @example
 * const rules = await getV5ToneRules(supabase, businessId)
 * // ["Skriv én tanke pr. sætning", "Tal direkte til gæsten", ...]
 */
export async function getV5ToneRules(
  supabase: SupabaseClient,
  businessId: string
): Promise<string[]> {
  
  const voice = await getV5Voice(supabase, businessId)
  return voice?.tone_rules || []
}

/**
 * Get typical openings (for content generation)
 */
export async function getV5TypicalOpenings(
  supabase: SupabaseClient,
  businessId: string
): Promise<string[]> {
  
  const examples = await getV5WritingExamples(supabase, businessId)
  return examples?.typical_openings || []
}

/**
 * Get typical closings (for content generation)
 */
export async function getV5TypicalClosings(
  supabase: SupabaseClient,
  businessId: string
): Promise<string[]> {
  
  const examples = await getV5WritingExamples(supabase, businessId)
  return examples?.typical_closings || []
}

/**
 * Get never_say rules (for content validation)
 */
export async function getV5NeverSay(
  supabase: SupabaseClient,
  businessId: string
): Promise<string[]> {
  
  const guardrails = await getV5Guardrails(supabase, businessId)
  return guardrails?.never_say || []
}

/**
 * Get brand essence (most common identity query)
 */
export async function getV5BrandEssence(
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  
  const identity = await getV5Identity(supabase, businessId)
  return identity?.brand_essence || ''
}

/**
 * Get core values (for content filtering)
 */
export async function getV5CoreValues(
  supabase: SupabaseClient,
  businessId: string
): Promise<string[]> {
  
  const identity = await getV5Identity(supabase, businessId)
  return identity?.core_values || []
}

// ============================================================================
// BATCH OPERATIONS - For Performance
// ============================================================================

/**
 * Get multiple profiles in single query (for dashboard/bulk operations)
 */
export async function getV5ProfilesBatch(
  supabase: SupabaseClient,
  businessIds: string[]
): Promise<Map<string, V5BrandProfile>> {
  
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('business_id, brand_profile_v5')
    .in('business_id', businessIds)
  
  if (error) {
    console.error('❌ Failed to fetch V5 profiles batch:', error)
    return new Map()
  }
  
  const profiles = new Map<string, V5BrandProfile>()
  
  for (const row of data || []) {
    if (row.brand_profile_v5) {
      profiles.set(row.business_id, row.brand_profile_v5)
    }
  }
  
  return profiles
}

// ============================================================================
// METADATA QUERIES
// ============================================================================

/**
 * Check if business has V5 profile
 */
export async function hasV5Profile(
  supabase: SupabaseClient,
  businessId: string
): Promise<boolean> {
  
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', businessId)
    .single()
  
  if (error) return false
  
  return data?.brand_profile_v5 !== null && data?.brand_profile_v5 !== undefined
}

/**
 * Get V5 profile version and generation timestamp
 */
export async function getV5ProfileMetadata(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ version: string; generatedAt: string } | null> {
  
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5_version, brand_profile_v5_generated_at')
    .eq('business_id', businessId)
    .single()
  
  if (error || !data) return null
  
  return {
    version: data.brand_profile_v5_version || '0.0',
    generatedAt: data.brand_profile_v5_generated_at || ''
  }
}

// ============================================================================
// PROGRAMME-SPECIFIC QUERIES (Common Pattern)
// ============================================================================

/**
 * Get audience segments for specific programme
 */
export async function getV5AudienceSegmentsForProgramme(
  supabase: SupabaseClient,
  businessId: string,
  programmeType: string
): Promise<any[]> {
  
  const programmes = await getV5Programmes(supabase, businessId)
  const programme = programmes.find(p => p.type === programmeType)
  
  return programme?.audienceSegments || []
}

/**
 * Get commercial orientation for specific programme
 */
export async function getV5CommercialOrientationForProgramme(
  supabase: SupabaseClient,
  businessId: string,
  programmeType: string
): Promise<any | null> {
  
  const programmes = await getV5Programmes(supabase, businessId)
  const programme = programmes.find(p => p.type === programmeType)
  
  return programme?.commercialOrientation || null
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format tone rules as bullet list (for prompt injection)
 */
export function formatToneRulesAsText(toneRules: string[]): string {
  if (toneRules.length === 0) return ''
  
  return toneRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')
}

/**
 * Format never_say rules as prompt instructions
 */
export function formatNeverSayAsText(neverSay: string[]): string {
  if (neverSay.length === 0) return ''
  
  return 'NEVER SAY:\n' + neverSay.map(rule => `- ${rule}`).join('\n')
}

/**
 * Get formatted voice guidelines for AI prompts
 */
export async function getV5VoiceForPrompt(
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  
  const voice = await getV5Voice(supabase, businessId)
  if (!voice) return ''
  
  const sections = []
  
  // Tone rules
  if (voice.tone_rules.length > 0) {
    sections.push('TONE RULES:')
    sections.push(formatToneRulesAsText(voice.tone_rules))
  }
  
  // Personality
  if (voice.personality_traits.length > 0) {
    sections.push(`\nPERSONALITY: ${voice.personality_traits.join(', ')}`)
  }
  
  // Style
  sections.push(`FORMALITY: ${voice.formality_level}`)
  sections.push(`SENTENCE STYLE: ${voice.sentence_structure}`)
  
  return sections.join('\n')
}

/**
 * Get formatted guardrails for AI prompts
 */
export async function getV5GuardrailsForPrompt(
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  
  const guardrails = await getV5Guardrails(supabase, businessId)
  if (!guardrails) return ''
  
  const sections = []
  
  // Never say rules
  if (guardrails.never_say.length > 0) {
    sections.push(formatNeverSayAsText(guardrails.never_say))
  }
  
  // Content exclusions
  if (guardrails.content_exclusions.length > 0) {
    sections.push('\nCONTENT EXCLUSIONS:')
    sections.push(guardrails.content_exclusions.map(e => `- ${e}`).join('\n'))
  }
  
  // Factual constraints
  if (guardrails.factual_constraints.length > 0) {
    sections.push('\nFACTUAL CONSTRAINTS:')
    sections.push(guardrails.factual_constraints.map(c => `- ${c}`).join('\n'))
  }
  
  return sections.join('\n')
}
