/**
 * V5 Brand Profile Field Extractors
 * 
 * Purpose: Centralized extraction logic for V5 JSONB → flat column migration
 * Strategy: V5-first with robust fallback chains
 * 
 * Usage:
 *   import { extractBrandEssence, extractCoreValues } from './v5-extractors.ts'
 *   const essence = extractBrandEssence(brandProfile)
 * 
 * Migration Context:
 *   - V5 writes to brand_profile_v5 JSONB (source of truth)
 *   - Legacy code reads from flat columns (often NULL post-V5)
 *   - These extractors provide V5-first reads with backward compatibility
 * 
 * Created: 2026-06-23
 * Phase: 1 - V5 Data Access Layer
 */

import { BrandProfile, BrandProfileV5 } from './types.ts'

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Check if brand profile has V5 data structure
 */
export function hasV5Data(profile: any): boolean {
  return !!(profile?.brand_profile_v5 && typeof profile.brand_profile_v5 === 'object')
}

/**
 * Check if V5 identity layer exists
 */
export function hasV5Identity(profile: any): boolean {
  return hasV5Data(profile) && 
         typeof profile.brand_profile_v5.identity === 'object' &&
         profile.brand_profile_v5.identity !== null
}

/**
 * Check if V5 voice layer exists
 */
export function hasV5Voice(profile: any): boolean {
  return hasV5Data(profile) && 
         typeof profile.brand_profile_v5.voice === 'object' &&
         profile.brand_profile_v5.voice !== null
}

/**
 * Check if V5 Layer 0 intelligence exists
 */
export function hasV5Layer0(profile: any): boolean {
  return hasV5Data(profile) && 
         typeof profile.brand_profile_v5.layer_0_intelligence === 'object' &&
         profile.brand_profile_v5.layer_0_intelligence !== null
}

/**
 * Safely handle legacy JSONB fields that may be {value: "..."} objects
 */
function extractLegacyJSONBValue(field: any): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  if (typeof field === 'object' && field.value) return field.value
  return null
}

// ============================================================================
// IDENTITY FIELD EXTRACTORS
// ============================================================================

/**
 * Extract brand essence with fallback chain:
 * 1. brand_profile_v5.identity.brand_essence (V5)
 * 2. brand_essence.value (legacy JSONB)
 * 3. brand_essence (TEXT column)
 * 4. '' (empty string)
 */
export function extractBrandEssence(profile: any): string {
  // V5 path (preferred)
  if (hasV5Identity(profile)) {
    const v5Essence = profile.brand_profile_v5.identity.brand_essence
    if (v5Essence && typeof v5Essence === 'string') {
      return v5Essence
    }
  }
  
  // Legacy fallback
  const legacyEssence = extractLegacyJSONBValue(profile.brand_essence)
  if (legacyEssence) return legacyEssence
  
  return ''
}

/**
 * Extract positioning statement
 * Fallback: brand_essence if positioning not available
 */
export function extractPositioning(profile: any): string {
  // V5 path
  if (hasV5Identity(profile)) {
    const v5Positioning = profile.brand_profile_v5.identity.positioning
    if (v5Positioning && typeof v5Positioning === 'string') {
      return v5Positioning
    }
  }
  
  // Legacy fallback
  const legacyPositioning = extractLegacyJSONBValue(profile.positioning)
  if (legacyPositioning) return legacyPositioning
  
  // Last resort: use brand essence
  return extractBrandEssence(profile)
}

/**
 * Extract core values array
 * Returns array of strings, never null
 */
export function extractCoreValues(profile: any): string[] {
  // V5 path
  if (hasV5Identity(profile)) {
    const v5Values = profile.brand_profile_v5.identity.core_values
    if (Array.isArray(v5Values) && v5Values.length > 0) {
      return v5Values.filter(v => typeof v === 'string' && v.length > 0)
    }
  }
  
  // Legacy fallback (could be array or JSONB)
  if (profile.core_values) {
    if (Array.isArray(profile.core_values)) {
      return profile.core_values.filter(v => typeof v === 'string' && v.length > 0)
    }
    if (typeof profile.core_values === 'object' && Array.isArray(profile.core_values.value)) {
      return profile.core_values.value.filter((v: any) => typeof v === 'string' && v.length > 0)
    }
  }
  
  return []
}

/**
 * Extract unique selling proposition (USP)
 */
export function extractUSP(profile: any): string {
  // V5 path
  if (hasV5Identity(profile)) {
    const v5USP = profile.brand_profile_v5.identity.what_makes_us_different
    if (v5USP && typeof v5USP === 'string') {
      return v5USP
    }
  }
  
  // Legacy fallback
  const legacyUSP = extractLegacyJSONBValue(profile.what_makes_us_different)
  if (legacyUSP) return legacyUSP
  
  return ''
}

/**
 * Extract identity reasoning (internal, not for prompts)
 */
export function extractIdentityReasoning(profile: any): string {
  if (hasV5Identity(profile)) {
    const reasoning = profile.brand_profile_v5.identity.identity_reasoning
    if (reasoning && typeof reasoning === 'string') {
      return reasoning
    }
  }
  return ''
}

// ============================================================================
// VOICE FIELD EXTRACTORS
// ============================================================================

/**
 * Extract tone rules array
 * V5: brand_profile_v5.voice.tone_rules
 * Legacy: tone_model.writing_rules
 */
export function extractToneRules(profile: any): string[] {
  // V5 path
  if (hasV5Voice(profile)) {
    const v5Rules = profile.brand_profile_v5.voice.tone_rules
    if (Array.isArray(v5Rules) && v5Rules.length > 0) {
      return v5Rules.filter(r => typeof r === 'string' && r.length > 0)
    }
  }
  
  // Legacy tone_model fallback
  if (profile.tone_model?.writing_rules) {
    if (Array.isArray(profile.tone_model.writing_rules)) {
      return profile.tone_model.writing_rules.filter((r: any) => typeof r === 'string' && r.length > 0)
    }
  }
  
  return []
}

/**
 * Extract voice reasoning/rationale
 */
export function extractVoiceRationale(profile: any): string {
  // V5 path
  if (hasV5Voice(profile)) {
    const v5Reasoning = profile.brand_profile_v5.voice.voice_reasoning
    if (v5Reasoning && typeof v5Reasoning === 'string') {
      return v5Reasoning
    }
  }
  
  // Legacy fallback
  const legacyRationale = extractLegacyJSONBValue(profile.voice_rationale)
  if (legacyRationale) return legacyRationale
  
  return ''
}

/**
 * Extract formality level
 */
export function extractFormalityLevel(profile: any): string {
  if (hasV5Voice(profile)) {
    const formality = profile.brand_profile_v5.voice.formality_level
    if (formality && typeof formality === 'string') {
      return formality
    }
  }
  return 'casual' // default
}

/**
 * Extract emoji usage preference
 */
export function extractEmojiUsage(profile: any): string {
  if (hasV5Voice(profile)) {
    const emoji = profile.brand_profile_v5.voice.emoji_usage
    if (emoji && typeof emoji === 'string') {
      return emoji
    }
  }
  return 'minimal' // default
}

/**
 * Extract sentence structure preference
 */
export function extractSentenceStructure(profile: any): string {
  if (hasV5Voice(profile)) {
    const structure = profile.brand_profile_v5.voice.sentence_structure
    if (structure && typeof structure === 'string') {
      return structure
    }
  }
  return 'varied' // default
}

/**
 * Extract good writing examples
 * V5: brand_profile_v5.writing_examples.good_examples
 * Flattened: enhanced_social_examples
 * Legacy: tone_model.good_examples
 */
export function extractGoodExamples(profile: any): string[] {
  // Check flattened column first (most recent)
  if (profile.enhanced_social_examples && Array.isArray(profile.enhanced_social_examples)) {
    return profile.enhanced_social_examples.filter((e: any) => typeof e === 'string' && e.length > 0)
  }
  
  // V5 path
  if (hasV5Data(profile) && profile.brand_profile_v5.writing_examples?.good_examples) {
    const v5Examples = profile.brand_profile_v5.writing_examples.good_examples
    if (Array.isArray(v5Examples)) {
      return v5Examples.filter(e => typeof e === 'string' && e.length > 0)
    }
  }
  
  // Legacy tone_model fallback
  if (profile.tone_model?.good_examples && Array.isArray(profile.tone_model.good_examples)) {
    return profile.tone_model.good_examples.filter((e: any) => typeof e === 'string' && e.length > 0)
  }
  
  return []
}

/**
 * Extract avoid examples
 * Flattened: enhanced_avoid_examples
 * V5: brand_profile_v5.writing_examples.avoid_examples
 */
export function extractAvoidExamples(profile: any): string[] {
  // Check flattened column first
  if (profile.enhanced_avoid_examples && Array.isArray(profile.enhanced_avoid_examples)) {
    return profile.enhanced_avoid_examples.filter((e: any) => typeof e === 'string' && e.length > 0)
  }
  
  // V5 path
  if (hasV5Data(profile) && profile.brand_profile_v5.writing_examples?.avoid_examples) {
    const v5AvoidExamples = profile.brand_profile_v5.writing_examples.avoid_examples
    if (Array.isArray(v5AvoidExamples)) {
      return v5AvoidExamples.filter(e => typeof e === 'string' && e.length > 0)
    }
  }
  
  return []
}

// ============================================================================
// GUARDRAILS & CONSTRAINTS
// ============================================================================

/**
 * Extract voice guardrails
 * Flattened: voice_guardrails (preferred - most recent)
 * V5: brand_profile_v5.guardrails
 * Legacy: things_to_avoid, voice_constraints
 */
export function extractVoiceGuardrails(profile: any): string[] {
  // Check flattened column first (V5.5+)
  if (profile.voice_guardrails && Array.isArray(profile.voice_guardrails)) {
    return profile.voice_guardrails.filter((g: any) => typeof g === 'string' && g.length > 0)
  }
  
  // V5 path
  if (hasV5Data(profile) && profile.brand_profile_v5.guardrails) {
    const v5Guardrails = profile.brand_profile_v5.guardrails
    
    // Collect all guardrail types
    const allGuardrails: string[] = []
    
    if (Array.isArray(v5Guardrails.forbidden_phrases)) {
      allGuardrails.push(...v5Guardrails.forbidden_phrases)
    }
    if (Array.isArray(v5Guardrails.forbidden_topics)) {
      allGuardrails.push(...v5Guardrails.forbidden_topics)
    }
    if (Array.isArray(v5Guardrails.seasonal_notes)) {
      allGuardrails.push(...v5Guardrails.seasonal_notes)
    }
    
    if (allGuardrails.length > 0) {
      return allGuardrails.filter(g => typeof g === 'string' && g.length > 0)
    }
  }
  
  // Legacy fallbacks
  const legacyGuardrails: string[] = []
  
  if (Array.isArray(profile.things_to_avoid)) {
    legacyGuardrails.push(...profile.things_to_avoid)
  }
  if (Array.isArray(profile.voice_constraints)) {
    legacyGuardrails.push(...profile.voice_constraints)
  }
  if (typeof profile.never_say === 'string' && profile.never_say.length > 0) {
    legacyGuardrails.push(profile.never_say)
  }
  
  return legacyGuardrails.filter(g => typeof g === 'string' && g.length > 0)
}

// ============================================================================
// LOCATION & CONTEXT
// ============================================================================

/**
 * Extract geographic narrative
 * V5: brand_profile_v5.layer_0_intelligence.geographic_context.narrative
 * Fallback: location_intelligence
 */
export function extractLocationNarrative(profile: any): string {
  // V5 path
  if (hasV5Layer0(profile)) {
    const geoContext = profile.brand_profile_v5.layer_0_intelligence.geographic_context
    if (geoContext?.narrative && typeof geoContext.narrative === 'string') {
      return geoContext.narrative
    }
  }
  
  // Legacy fallback (could be JSONB or text)
  if (profile.location_intelligence) {
    if (typeof profile.location_intelligence === 'string') {
      return profile.location_intelligence
    }
    if (typeof profile.location_intelligence === 'object' && profile.location_intelligence.narrative) {
      return profile.location_intelligence.narrative
    }
  }
  
  return ''
}

/**
 * Extract city name
 */
export function extractCity(profile: any): string {
  if (hasV5Layer0(profile)) {
    const city = profile.brand_profile_v5.layer_0_intelligence.geographic_context?.city
    if (city && typeof city === 'string') {
      return city
    }
  }
  return ''
}

/**
 * Extract area type (e.g., "urban_center", "residential")
 */
export function extractAreaType(profile: any): string {
  if (hasV5Layer0(profile)) {
    const areaType = profile.brand_profile_v5.layer_0_intelligence.geographic_context?.area_type
    if (areaType && typeof areaType === 'string') {
      return areaType
    }
  }
  return ''
}

// ============================================================================
// AUDIENCE & STRATEGY
// ============================================================================

/**
 * Extract strategic audience segments
 * Flattened: strategic_audience_segments (preferred)
 * V5: brand_profile_v5.layer_4_audiences
 * Legacy: audience_segments, target_audience
 */
export function extractAudienceSegments(profile: any): any[] {
  // Check flattened column first
  if (profile.strategic_audience_segments && Array.isArray(profile.strategic_audience_segments)) {
    return profile.strategic_audience_segments
  }
  
  // V5 path
  if (hasV5Data(profile) && profile.brand_profile_v5.layer_4_audiences) {
    const v5Audiences = profile.brand_profile_v5.layer_4_audiences
    if (Array.isArray(v5Audiences)) {
      return v5Audiences
    }
  }
  
  // Legacy fallback
  if (profile.audience_segments && Array.isArray(profile.audience_segments)) {
    return profile.audience_segments
  }
  
  return []
}

/**
 * Extract content strategy
 * Flattened: content_strategy (written by V5)
 * Fallback: derive from programmes/menu
 */
export function extractContentStrategy(profile: any): any {
  // Check flattened column (V5 writes this)
  if (profile.content_strategy && typeof profile.content_strategy === 'object') {
    return profile.content_strategy
  }
  
  // No V5 JSONB path - content_strategy is derived and flattened directly
  return null
}

// ============================================================================
// COMBINED EXTRACTORS (Complex objects)
// ============================================================================

/**
 * Extract complete voice configuration
 * Combines multiple V5 voice paths into single object
 */
export function extractVoiceConfiguration(profile: any): {
  tone_rules: string[]
  formality_level: string
  emoji_usage: string
  sentence_structure: string
  voice_reasoning: string
  good_examples: string[]
  avoid_examples: string[]
  guardrails: string[]
} {
  return {
    tone_rules: extractToneRules(profile),
    formality_level: extractFormalityLevel(profile),
    emoji_usage: extractEmojiUsage(profile),
    sentence_structure: extractSentenceStructure(profile),
    voice_reasoning: extractVoiceRationale(profile),
    good_examples: extractGoodExamples(profile),
    avoid_examples: extractAvoidExamples(profile),
    guardrails: extractVoiceGuardrails(profile)
  }
}

/**
 * Extract complete identity configuration
 */
export function extractIdentityConfiguration(profile: any): {
  brand_essence: string
  positioning: string
  core_values: string[]
  usp: string
  reasoning: string
} {
  return {
    brand_essence: extractBrandEssence(profile),
    positioning: extractPositioning(profile),
    core_values: extractCoreValues(profile),
    usp: extractUSP(profile),
    reasoning: extractIdentityReasoning(profile)
  }
}

/**
 * Extract complete location configuration
 */
export function extractLocationConfiguration(profile: any): {
  city: string
  area_type: string
  narrative: string
} {
  return {
    city: extractCity(profile),
    area_type: extractAreaType(profile),
    narrative: extractLocationNarrative(profile)
  }
}

// ============================================================================
// LOGGING & DIAGNOSTICS
// ============================================================================

/**
 * Log which data source was used for extraction
 * Useful for monitoring V5 adoption rate
 */
export function logExtractionSource(
  fieldName: string,
  usedV5: boolean,
  businessId: string
): void {
  const source = usedV5 ? 'V5_JSONB' : 'LEGACY_FLAT'
  console.log(`[V5_EXTRACTION] ${fieldName} | ${source} | ${businessId}`)
}

/**
 * Get diagnostic report of V5 vs legacy usage
 * Returns object showing which paths were used
 */
export function getV5DiagnosticReport(profile: any): {
  has_v5_data: boolean
  has_v5_identity: boolean
  has_v5_voice: boolean
  has_v5_layer_0: boolean
  extraction_sources: Record<string, 'V5' | 'LEGACY' | 'NONE'>
} {
  const sources: Record<string, 'V5' | 'LEGACY' | 'NONE'> = {}
  
  // Check each field
  if (hasV5Identity(profile) && profile.brand_profile_v5.identity.brand_essence) {
    sources.brand_essence = 'V5'
  } else if (profile.brand_essence) {
    sources.brand_essence = 'LEGACY'
  } else {
    sources.brand_essence = 'NONE'
  }
  
  if (hasV5Identity(profile) && profile.brand_profile_v5.identity.positioning) {
    sources.positioning = 'V5'
  } else if (profile.positioning) {
    sources.positioning = 'LEGACY'
  } else {
    sources.positioning = 'NONE'
  }
  
  if (hasV5Voice(profile) && profile.brand_profile_v5.voice.tone_rules) {
    sources.tone_rules = 'V5'
  } else if (profile.tone_model?.writing_rules) {
    sources.tone_rules = 'LEGACY'
  } else {
    sources.tone_rules = 'NONE'
  }
  
  return {
    has_v5_data: hasV5Data(profile),
    has_v5_identity: hasV5Identity(profile),
    has_v5_voice: hasV5Voice(profile),
    has_v5_layer_0: hasV5Layer0(profile),
    extraction_sources: sources
  }
}
