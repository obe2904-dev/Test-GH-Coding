/**
 * UNIFIED BRAND VOICE TYPE v17
 * 
 * Purpose: Single source of truth for brand voice data structure
 * Replaces 5 competing type definitions across the codebase
 * 
 * Database Schema: business_brand_profile table (44 columns)
 * Primary Fields: Enriched fields (8) - use these for AI caption generation
 * Legacy Fields: Deprecated fields (4) - maintain for backward compatibility
 * 
 * Migration Status: Phase 1 (Database cleanup complete + unified type)
 * Next: Phase 2 (Context-aware anti-patterns), Phase 3 (Country templates)
 * 
 * Related Docs:
 * - DATABASE_TYPES_ANALYSIS_V17.md
 * - BRAND_VOICE_ARCHITECTURE_V17.md
 */

// ============================================================================
// UNIFIED BRAND VOICE INTERFACE
// ============================================================================

/**
 * Complete brand voice profile from business_brand_profile table
 * 
 * ENRICHED FIELDS (✅ PRIMARY - Use for AI caption generation):
 * - never_say: 107 Danish banned words/phrases ("kom forbi", "nyd", etc.)
 * - signature_phrases: Brand-specific phrases ("ved åen i Aarhus")
 * - typical_openings: Example opening sentences for tone learning
 * - typical_closings: Example closing sentences with CTAs
 * 
 * PERSONALITY TRAITS (✅ PRIMARY):
 * - humor_level: none | subtle | playful | bold
 * - formality: casual | professional | formal
 * - emoji_style: none | minimal | moderate | expressive
 * - storytelling_style: minimal | some_context | detailed
 * 
 * LEGACY FIELDS (⚠️ DEPRECATED - Maintain for backward compatibility):
 * - do_not_say: JSONB {words: []} - replaced by never_say
 * - tone_keywords: Simple keywords ["friendly", "welcoming"]
 * - voice_style: Free-text description - replaced by structured traits
 * - values: Brand values (rarely used)
 * - certifications: Business certifications (rarely used)
 */
export interface BrandVoice {
  // ✅ ENRICHED FIELDS - Primary data for AI caption generation
  never_say?: string[]                // Banned words/phrases (Danish)
  signature_phrases?: string[]        // Brand-specific phrases to use
  typical_openings?: string[]         // Example opening sentences
  typical_closings?: string[]         // Example closing sentences
  
  // ✅ PERSONALITY TRAITS - Structured tone control
  humor_level?: 'none' | 'subtle' | 'playful' | 'bold'
  formality?: 'casual' | 'professional' | 'formal'
  emoji_style?: 'none' | 'minimal' | 'moderate' | 'expressive'
  storytelling_style?: 'minimal' | 'some_context' | 'detailed'
  
  // ⚠️ LEGACY FIELDS - Deprecated but maintained for backward compatibility
  do_not_say?: {                      // Replaced by never_say array
    words: string[]
  }
  tone_keywords?: string[]            // Replaced by personality traits
  voice_style?: string                // Replaced by formality + humor_level
  values?: string[]                   // Rarely used
  certifications?: string[]           // Rarely used
}

/**
 * Minimal brand voice for simple use cases
 * Used when only basic tone information is needed
 */
export interface MinimalBrandVoice {
  tone?: 'casual' | 'professional' | 'formal'
  emoji_frequency?: 'none' | 'minimal' | 'moderate' | 'frequent'
  voice_description?: string
}

/**
 * Brand voice metadata for quality tracking
 */
export interface BrandVoiceMetadata {
  voice_extraction_source?: string    // ai_gpt4o, ai_gpt4o_hybrid, manual
  voice_extracted_at?: string         // ISO timestamp
  voice_confidence_score?: number     // 0-100
  updated_at?: string                 // ISO timestamp
}

/**
 * Complete brand voice with metadata
 */
export interface BrandVoiceWithMetadata extends BrandVoice {
  metadata?: BrandVoiceMetadata
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if brand voice has enriched fields populated
 * 
 * Enriched voice includes:
 * - never_say array (banned words)
 * - signature_phrases array
 * - At least one of: typical_openings, typical_closings
 * - At least one personality trait (humor_level, formality, emoji_style)
 * 
 * @param voice - Brand voice object to check
 * @returns true if enriched fields are populated
 */
export function hasEnrichedVoice(voice: BrandVoice | null | undefined): boolean {
  if (!voice) return false
  
  const hasNeverSay = Array.isArray(voice.never_say) && voice.never_say.length > 0
  const hasSignaturePhrases = Array.isArray(voice.signature_phrases) && voice.signature_phrases.length > 0
  const hasOpeningsOrClosings = 
    (Array.isArray(voice.typical_openings) && voice.typical_openings.length > 0) ||
    (Array.isArray(voice.typical_closings) && voice.typical_closings.length > 0)
  const hasPersonalityTraits = 
    voice.humor_level !== undefined || 
    voice.formality !== undefined || 
    voice.emoji_style !== undefined
  
  return hasNeverSay && hasSignaturePhrases && (hasOpeningsOrClosings || hasPersonalityTraits)
}

/**
 * Check if brand voice only has legacy fields
 * 
 * @param voice - Brand voice object to check
 * @returns true if only legacy fields are populated
 */
export function hasOnlyLegacyVoice(voice: BrandVoice | null | undefined): boolean {
  if (!voice) return false
  
  const hasLegacy = 
    (voice.do_not_say && voice.do_not_say.words.length > 0) ||
    (voice.tone_keywords && voice.tone_keywords.length > 0) ||
    voice.voice_style !== undefined
  
  const hasEnriched = hasEnrichedVoice(voice)
  
  return hasLegacy && !hasEnriched
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Migrate legacy brand voice fields to enriched format
 * 
 * Conversions:
 * - do_not_say.words → never_say
 * - tone_keywords + voice_style → approximate personality traits
 * 
 * Note: This is a best-effort migration. Manual review recommended.
 * 
 * @param voice - Brand voice with legacy fields
 * @returns Brand voice with enriched fields populated
 */
export function migrateLegacyVoice(voice: BrandVoice): BrandVoice {
  const enriched: BrandVoice = { ...voice }
  
  // Migrate do_not_say.words → never_say
  if (voice.do_not_say?.words && voice.do_not_say.words.length > 0) {
    if (!enriched.never_say || enriched.never_say.length === 0) {
      enriched.never_say = voice.do_not_say.words
    }
  }
  
  // Approximate formality from voice_style
  if (voice.voice_style && !enriched.formality) {
    const style = voice.voice_style.toLowerCase()
    if (style.includes('formal') || style.includes('professional')) {
      enriched.formality = 'formal'
    } else if (style.includes('casual') || style.includes('friendly')) {
      enriched.formality = 'casual'
    } else {
      enriched.formality = 'professional' // default
    }
  }
  
  // Approximate humor_level from tone_keywords
  if (voice.tone_keywords && !enriched.humor_level) {
    const keywords = voice.tone_keywords.join(' ').toLowerCase()
    if (keywords.includes('playful') || keywords.includes('fun')) {
      enriched.humor_level = 'playful'
    } else if (keywords.includes('warm') || keywords.includes('friendly')) {
      enriched.humor_level = 'subtle'
    } else {
      enriched.humor_level = 'none'
    }
  }
  
  // Default emoji_style based on formality
  if (!enriched.emoji_style) {
    if (enriched.formality === 'casual') {
      enriched.emoji_style = 'moderate'
    } else if (enriched.formality === 'formal') {
      enriched.emoji_style = 'none'
    } else {
      enriched.emoji_style = 'minimal'
    }
  }
  
  // Default storytelling_style
  if (!enriched.storytelling_style) {
    enriched.storytelling_style = 'some_context'
  }
  
  return enriched
}

/**
 * Get banned words from brand voice (prioritize enriched fields)
 * 
 * Priority:
 * 1. never_say array (enriched field)
 * 2. do_not_say.words (legacy field)
 * 3. Empty array
 * 
 * @param voice - Brand voice object
 * @returns Array of banned words
 */
export function getBannedWords(voice: BrandVoice | null | undefined): string[] {
  if (!voice) return []
  
  // Priority 1: never_say array
  if (Array.isArray(voice.never_say) && voice.never_say.length > 0) {
    return voice.never_say
  }
  
  // Priority 2: do_not_say.words (legacy)
  if (voice.do_not_say?.words && voice.do_not_say.words.length > 0) {
    return voice.do_not_say.words
  }
  
  return []
}

/**
 * Get formality level from brand voice
 * 
 * Priority:
 * 1. formality field (enriched)
 * 2. voice_style field (legacy - approximate)
 * 3. Default: 'casual'
 * 
 * @param voice - Brand voice object
 * @returns Formality level
 */
export function getFormality(voice: BrandVoice | null | undefined): 'casual' | 'professional' | 'formal' {
  if (!voice) return 'casual'
  
  // Priority 1: formality field
  if (voice.formality) {
    return voice.formality
  }
  
  // Priority 2: voice_style (legacy approximation)
  if (voice.voice_style) {
    const style = voice.voice_style.toLowerCase()
    if (style.includes('formal') || style.includes('professional')) {
      return 'formal'
    }
    if (style.includes('casual') || style.includes('friendly')) {
      return 'casual'
    }
    return 'professional'
  }
  
  return 'casual'
}

/**
 * Get emoji style from brand voice
 * 
 * Priority:
 * 1. emoji_style field (enriched)
 * 2. Formality-based default
 * 3. Default: 'minimal'
 * 
 * @param voice - Brand voice object
 * @returns Emoji style
 */
export function getEmojiStyle(voice: BrandVoice | null | undefined): 'none' | 'minimal' | 'moderate' | 'expressive' {
  if (!voice) return 'minimal'
  
  // Priority 1: emoji_style field
  if (voice.emoji_style) {
    return voice.emoji_style
  }
  
  // Priority 2: Formality-based default
  const formality = getFormality(voice)
  if (formality === 'formal') return 'none'
  if (formality === 'casual') return 'moderate'
  
  return 'minimal'
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate brand voice data quality
 * 
 * Checks:
 * - At least one of: enriched OR legacy fields populated
 * - never_say array has Danish content (contains æ, ø, å)
 * - signature_phrases array is not empty if present
 * - Valid enum values for personality traits
 * 
 * @param voice - Brand voice object to validate
 * @returns Validation result with errors
 */
export function validateBrandVoice(voice: BrandVoice | null | undefined): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!voice) {
    errors.push('Brand voice is null or undefined')
    return { valid: false, errors, warnings }
  }
  
  // Check if at least one field is populated
  const hasAnyField = 
    hasEnrichedVoice(voice) || 
    hasOnlyLegacyVoice(voice)
  
  if (!hasAnyField) {
    errors.push('No enriched or legacy brand voice fields populated')
  }
  
  // Validate never_say array
  if (voice.never_say && voice.never_say.length > 0) {
    const hasDanishChars = voice.never_say.some(word => 
      /[æøåÆØÅ]/.test(word)
    )
    if (!hasDanishChars) {
      warnings.push('never_say array does not contain Danish characters (æ, ø, å)')
    }
    
    // Check for critical generic Danish terms
    const criticalTerms = ['kom forbi', 'nyd', 'kaffepause']
    const missingTerms = criticalTerms.filter(term => 
      !voice.never_say!.includes(term)
    )
    if (missingTerms.length > 0) {
      warnings.push(`never_say missing critical Danish terms: ${missingTerms.join(', ')}`)
    }
  }
  
  // Validate signature_phrases
  if (voice.signature_phrases && voice.signature_phrases.length === 0) {
    warnings.push('signature_phrases array is empty')
  }
  
  // Validate enum values
  if (voice.humor_level && !['none', 'subtle', 'playful', 'bold'].includes(voice.humor_level)) {
    errors.push(`Invalid humor_level: ${voice.humor_level}`)
  }
  if (voice.formality && !['casual', 'professional', 'formal'].includes(voice.formality)) {
    errors.push(`Invalid formality: ${voice.formality}`)
  }
  if (voice.emoji_style && !['none', 'minimal', 'moderate', 'expressive'].includes(voice.emoji_style)) {
    errors.push(`Invalid emoji_style: ${voice.emoji_style}`)
  }
  if (voice.storytelling_style && !['minimal', 'some_context', 'detailed'].includes(voice.storytelling_style)) {
    errors.push(`Invalid storytelling_style: ${voice.storytelling_style}`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  MinimalBrandVoice,
  BrandVoiceMetadata,
  BrandVoiceWithMetadata
}
