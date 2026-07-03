// supabase/functions/_shared/content-planning/brand-voice-loader.ts
// Minimal brand voice loader: extracts only essential voice properties
// Prevents context bloat by loading ONLY the 5 critical properties

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Minimal brand voice properties (5 only!)
 * This is the MINIMAL context needed for caption writing.
 * DO NOT add more properties - this prevents AI context drift.
 */
export interface MinimalBrandVoice {
  essence: string  // 1-2 sentence brand essence
  neverSay: string[]  // Max 5 forbidden phrases/words
  alwaysSay: string[]  // Max 5 signature phrases
  forbiddenPhrases: string[]  // Specific cliché phrases to avoid
  weatherClichesToAvoid: string[]  // Weather-specific clichés (e.g., "sommerens varme aftener")
}

/**
 * Default safe voice for businesses without brand profile
 * Universal Danish hospitality tone that works for 90% of cases
 */
const DEFAULT_VOICE: MinimalBrandVoice = {
  essence: 'Venlig og informativ dansk hospitality tone. Autentisk, jordnær, uden at være for poetisk.',
  neverSay: [
    'åens første lys',
    'når solen kigger frem',
    'kulinarisk rejse',
    'gastronomi på højeste niveau',
    'smag af sæson'
  ],
  alwaysSay: [],  // No forced phrases for default voice
  forbiddenPhrases: [
    'nyd weekenden',
    'kom forbi og smag',
    'åens første lys',
    'når vejret inviterer',
    'under de varme solstråler'
  ],
  weatherClichesToAvoid: [
    'sommerens varme aftener',
    'når solen kigger frem',
    'regnen banker på',
    'solskins vejr',
    'perfekt til en regnvejrsdag'
  ]
}

/**
 * Load minimal brand voice from database
 * Extracts ONLY the 5 essential properties needed for caption writing.
 * 
 * **Critical:** This function intentionally loads minimal context to prevent
 * AI context drift. Do NOT expand this to load full brand profile.
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @returns Minimal brand voice object (5 properties only)
 * 
 * @example
 * ```ts
 * const voice = await loadMinimalBrandVoice(supabase, businessId)
 * 
 * // Use in AI prompt:
 * const prompt = `
 *   Brand essence: ${voice.essence}
 *   Never say: ${voice.neverSay.join(', ')}
 *   Signature phrases: ${voice.alwaysSay.join(', ')}
 * `
 * ```
 */
export async function loadMinimalBrandVoice(
  supabase: SupabaseClient,
  businessId: string
): Promise<MinimalBrandVoice> {
  
  // Step 1: Query ONLY the voice-related columns from brand profile
  // DO NOT query full brand profile - causes context bloat
  // Note: tone_of_voice is text field, not structured JSONB
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_essence, tone_of_voice')
    .eq('business_id', businessId)
    .single()

  if (error) {
    console.warn('⚠️ No brand profile found, using default voice:', error.message)
    return DEFAULT_VOICE
  }

  if (!data) {
    console.warn('⚠️ Empty brand profile, using default voice')
    return DEFAULT_VOICE
  }

  // Step 2: Extract and sanitize voice properties
  const essence = sanitizeEssence(data.brand_essence)
  
  // Parse tone_of_voice if it exists (may be text or JSONB)
  let neverSay: string[] = []
  let alwaysSay: string[] = []
  let forbiddenPhrases: string[] = []
  let weatherCliches: string[] = []
  
  if (data.tone_of_voice) {
    try {
      // Try parsing as JSON first
      const toneData = typeof data.tone_of_voice === 'string' 
        ? JSON.parse(data.tone_of_voice)
        : data.tone_of_voice
      
      // Extract arrays from various possible structures
      neverSay = sanitizeArray(toneData.never_say || toneData.neverSay || toneData.forbidden_words, 5)
      alwaysSay = sanitizeArray(toneData.always_say || toneData.alwaysSay || toneData.signature_phrases, 5)
      forbiddenPhrases = sanitizeArray(toneData.forbidden_phrases || toneData.forbiddenPhrases, 10)
      weatherCliches = sanitizeArray(toneData.weather_cliches_to_avoid || toneData.weatherClichesToAvoid, 10)
    } catch (e) {
      console.warn('⚠️ Could not parse tone_of_voice, using defaults:', e)
    }
  }

  return {
    essence,
    neverSay: neverSay.length > 0 ? neverSay : DEFAULT_VOICE.neverSay,
    alwaysSay,
    forbiddenPhrases: forbiddenPhrases.length > 0 ? forbiddenPhrases : DEFAULT_VOICE.forbiddenPhrases,
    weatherClichesToAvoid: weatherCliches.length > 0 ? weatherCliches : DEFAULT_VOICE.weatherClichesToAvoid
  }
}

/**
 * Validate brand voice quality
 * Ensures voice properties are useful and not empty/generic
 * 
 * @param voice - Brand voice to validate
 * @returns true if voice has sufficient quality, false if should use default
 */
export function validateBrandVoice(voice: MinimalBrandVoice): boolean {
  // Essence should be meaningful (>20 chars)
  if (!voice.essence || voice.essence.length < 20) {
    return false
  }

  // Should have at least 2 items in neverSay OR alwaysSay
  const totalGuidance = voice.neverSay.length + voice.alwaysSay.length
  if (totalGuidance < 2) {
    return false
  }

  return true
}

/**
 * Load brand voice with quality validation
 * Falls back to default voice if loaded voice is low quality
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @returns High-quality brand voice (loaded or default)
 */
export async function loadValidatedBrandVoice(
  supabase: SupabaseClient,
  businessId: string
): Promise<MinimalBrandVoice> {
  
  const voice = await loadMinimalBrandVoice(supabase, businessId)
  
  if (!validateBrandVoice(voice)) {
    console.warn('⚠️ Brand voice quality insufficient, using default')
    return DEFAULT_VOICE
  }

  return voice
}

// ── Helper Functions ──

/**
 * Sanitize brand essence text
 * Ensures essence is concise and meaningful
 */
function sanitizeEssence(essence: any): string {
  if (typeof essence !== 'string') {
    return DEFAULT_VOICE.essence
  }

  const cleaned = essence.trim()
  
  // Truncate if too long (max 300 chars)
  if (cleaned.length > 300) {
    return cleaned.substring(0, 297) + '...'
  }

  return cleaned || DEFAULT_VOICE.essence
}

/**
 * Sanitize array of strings
 * Ensures array contains valid strings and respects max length
 */
function sanitizeArray(value: any, maxItems: number = 5): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(item => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
    .slice(0, maxItems)  // Enforce max items
}

/**
 * Format brand voice for AI prompt
 * Converts MinimalBrandVoice to compact string format
 * 
 * @param voice - Brand voice object
 * @returns Formatted string for AI prompt (compact)
 */
export function formatVoiceForPrompt(voice: MinimalBrandVoice): string {
  const parts: string[] = []

  if (voice.essence) {
    parts.push(`Brand: ${voice.essence}`)
  }

  if (voice.neverSay.length > 0) {
    parts.push(`Undgå: ${voice.neverSay.join(', ')}`)
  }

  if (voice.alwaysSay.length > 0) {
    parts.push(`Brug: ${voice.alwaysSay.join(', ')}`)
  }

  if (voice.forbiddenPhrases.length > 0) {
    parts.push(`Forbudte fraser: ${voice.forbiddenPhrases.slice(0, 3).join(', ')}`)
  }

  return parts.join('\n')
}
