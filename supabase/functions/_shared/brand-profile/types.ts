/**
 * Brand Profile Generator - Type Definitions
 * 
 * Centralized types for the brand profile generation system.
 * All modules import from this file to ensure type consistency.
 */

// ============================================================================
// CONFIDENCE TYPES & UTILITIES
// ============================================================================

/**
 * Confidence level enum for AI-generated analysis.
 * 
 * AI models output this enum (more reliable than numeric scores).
 * Internal logic uses numeric scores for thresholds and averaging.
 * 
 * Usage:
 * - Prompt A: AI outputs "high", "medium", or "low" for each extracted item
 * - Internal: Converted to numeric (high=0.85, medium=0.6, low=0.35) for averaging
 * - Database: Stored as both level + score in confidence_metadata JSONB
 */
export type Confidence = "high" | "medium" | "low"

/**
 * Maps confidence enum to numeric score for internal calculations.
 * Used for averaging multiple confidence values and threshold checks.
 */
export function confidenceToScore(level: Confidence): number {
  const map: Record<Confidence, number> = {
    high: 0.85,
    medium: 0.6,
    low: 0.35
  }
  return map[level]
}

/**
 * Maps numeric score to confidence enum for display/storage.
 * Used when computing confidence from evidence flags.
 */
export function scoreToConfidence(score: number): Confidence {
  if (score >= 0.70) return "high"
  if (score >= 0.45) return "medium"
  return "low"
}

// ============================================================================
// GEO CONTEXT TYPES
// ============================================================================

/**
 * Micro location cue types for distinctive location context.
 * 
 * These categorical cues help identify venue positioning beyond just city/address.
 * Used in Prompt A extraction, consumed in Prompt B for brand_essence and signature_shot.
 */
export type MicroLocationCue = 
  | "near_railway_station"
  | "in_tourist_area"
  | "by_waterfront"
  | "near_harbor"
  | "near_mall"
  | "on_high_street"
  | "industrial_area"
  | "near_university"
  | "residential_neighborhood"
  | "city_center"
  | "suburb"
  | "other"

/**
 * Evidence for geo context extraction.
 */
export interface GeoEvidence {
  quote: string  // Max 180 chars
  source: string // e.g., "business_locations|address" or "website_analysis|hero"
  confidence: Confidence
}

/**
 * Geographic context for venue.
 * Extracted in Prompt A, used in Prompt B for location-specific framing.
 */
export interface GeoContext {
  city: string  // Required (from business.city)
  area_hint?: string  // Optional: "centrum", "havnefront", "latinerkvarter", etc.
  evidence: GeoEvidence[]  // 0-3 evidence items
}

/**
 * Micro location context item (distinctive location cues).
 */
export interface MicroLocationContext {
  cue_type: MicroLocationCue  // Categorical cue type
  description: string  // Human-readable: "ved åen", "near Bruuns Galleri"
  evidence: string  // Exact quote/snippet
  source: string  // Provenance
  confidence: Confidence
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface OpenAIConfig {
  timeout: number
  maxRetries: number
  retryDelayMs: number
  retryStatusCodes: number[]
}

export interface AIModels {
  analysis: string  // Prompt A model
  generation: string // Prompt B model
}

// ============================================================================
// LANGUAGE TYPES
// ============================================================================

export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  systemPromptA: string
  instructionsPromptA: string
  countryMappings: string[]
  // Prompt B translations (for user-facing output)
  translations: {
    clarificationsNeeded: string
    internalNotes: string
    insufficientData: string
    inferred: string
    lowConfidence: string
  }
}

export interface LanguageRegistry {
  languages: Record<string, LanguageConfig>
  countryFallbacks: Record<string, string>
  defaultLanguage: string
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface BrandProfileRequest {
  businessId: string
  forceRegenerate?: boolean
  allowThirdParty?: boolean
}

export interface BrandProfileResponse {
  success: boolean
  brandProfile?: BrandProfile
  error?: string
  requestId?: string
}

// ============================================================================
// DATA SOURCE TYPES
// ============================================================================

export interface ThirdPartyEvidence {
  googleMaps?: {
    photos?: Array<{
      url: string
      labels?: string[]
      uploaded_by: 'owner' | 'customer'
    }>
    reviews?: Array<{
      text: string
      rating: number
      recurring_terms?: string[]
    }>
  }
  instagram?: {
    businessPosts?: Array<{
      caption: string
      image_labels?: string[]
      post_date: string
    }>
  }
}

export interface DataSources {
  // Tier 1 - Authoritative (owned by business)
  business: any
  location: any | null  // Primary business location with enrichment data
  profile: any
  menu: any[]
  images: any[]
  
  // Tier 2 - Supporting (crawled/analyzed)
  websiteAnalysis: any
  socialAccounts: any[]
  
  // Tier 3 - Third-party (conditional, read-only)
  thirdPartyEvidence?: ThirdPartyEvidence
}

// ============================================================================
// ANALYSIS TYPES (Prompt A output)
// ============================================================================

export interface InternalAnalysis {
  brandIdentity: {
    coreValues: string[]
    uniqueAttributes: string[]
    positioning: string
  }
  audienceInsights: {
    primaryDemographic: string
    needs: string[]
    language: string
  }
  offeringAnalysis: {
    topProducts: string[]
    serviceStyle: string
  }
  communicationPatterns: {
    toneSignals: string[]
    commonPhrases: string[]
    avoidancePatterns: string[]
  }
  confidence: {
    dataQuality: number // 0-1
    signalsFound: string[]
  }
}

export interface SignalExtraction {
  mustUsePhrases: string[]
  ctaTexts: string[]
  valuePhrases: string[]
  menuCategoriesMentioned: string[]
  aboutTone: string
  rawExcerpt: string
}

// ============================================================================
// BRAND PROFILE TYPES (Prompt B output)
// ============================================================================

export type ConfidenceLevel = 'high' | 'inferred' | 'medium' | 'low'

export interface BrandVariable<TValue = string> {
  value: TValue
  confidence_score: number
  confidence_level: ConfidenceLevel
  signals_used: string[]
}

export interface ImagePreferencesValue {
  dos: string[]
  donts: string[]
  signature_shot: string
}

export interface ThingsToAvoidValue {
  language_constraints: string[]
  factual_constraints: string[]
}

export type ContentPillar = 'Crave-worthy' | 'BTS' | 'Social proof' | 'Vibe' | 'Engagement' | 'Offers'

export interface ContentPillarItem {
  pillar: ContentPillar
  allowed: boolean
  encouraged: boolean
  notes: string
}

export interface HashtagStrategy {
  branded: string[]
  category: string[]
  local: string[]
}

export interface SocialStyleValue {
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'expressive'
  emoji_examples: string[]
  hashtag_strategy: HashtagStrategy
}

export interface VocabularyPreferences {
  prefer: string[]
  avoid: string[]
}

export interface VoiceExamplesValue {
  do_say: string[]
  dont_say: string[]
  vocabulary: VocabularyPreferences
}

export type LocationProfile = 'MAJOR_CITY_CENTER' | 'TRENDY_NEIGHBORHOOD' | 'SUBURBAN_RESIDENTIAL' | 'SMALL_TOWN_RURAL' | 'TOURIST_AREA'
export type BusinessPersonality = 'TRADITIONAL_COZY' | 'MODERN_CASUAL' | 'URBAN_TRENDY' | 'PREMIUM_REFINED' | 'LOCAL_AUTHENTIC'
export type LanguageMix = 'PURE_DANISH' | 'DANISH_PRIMARY' | 'BILINGUAL' | 'ENGLISH_PRIMARY'
export type EnergyLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface VoiceContext {
  location_profile: LocationProfile
  business_personality: BusinessPersonality
  language_mix: LanguageMix
  energy_level: EnergyLevel
}

/**
 * Structured tone model v2 for AI generation with metadata.
 * Provides machine-usable tone guidance with keywords, rules, examples, and metadata for versioning/quality control.
 */
export interface ToneModel {
  // Core tone data
  primary_keywords: string[]  // 2-6 core adjectives for validation (e.g., ["hyggelig", "varm"])
  writing_rules: string[]     // 3-8 actionable style rules
  good_examples: string[]     // 2-6 example phrases that capture the tone
  avoid_examples: string[]    // 2-6 phrases to avoid with reasons
  formality: 'formal' | 'informal' | 'mixed'
  emoji_level: 'none' | 'minimal' | 'moderate' | 'frequent'
  
  // Metadata (v2 - enables versioning, multi-language, quality control)
  version: string             // Schema version (e.g., "2.0") - enables safe migrations
  language: string            // ISO 639-1 language code (e.g., "da", "en") - critical for multi-language
  generated_at: string        // ISO 8601 timestamp - audit trail
  source: 'website' | 'manual' | 'hybrid'  // Data source - debugging/quality
  confidence: 'high' | 'medium' | 'low'    // Extraction confidence - quality control
  notes?: string              // Optional debug info - troubleshooting
}

export interface BrandProfile {
  brand_essence: BrandVariable<string>
  tone_of_voice: BrandVariable<string>
  tone_model: ToneModel  // NEW: Structured tone model for AI generation
  things_to_avoid: BrandVariable<ThingsToAvoidValue>
  target_audience: BrandVariable<string>
  core_offerings: BrandVariable<string>
  content_focus: BrandVariable<string>
  content_pillars: BrandVariable<ContentPillarItem[]>
  cta_style: BrandVariable<string>
  communication_goal: BrandVariable<string>
  recognizable_interior_identity: BrandVariable<string> // Conditional: only populated with visual evidence
  image_preferences: BrandVariable<ImagePreferencesValue>
  social_style: BrandVariable<SocialStyleValue>
  voice_examples: BrandVariable<VoiceExamplesValue>
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  repairedProfile?: BrandProfile
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface BrandProfileRecord {
  business_id: string
  brand_essence: string | null
  brand_essence_confidence: number | null
  brand_essence_signals: string[] | null
  tone_of_voice: string | null
  tone_of_voice_confidence: number | null
  tone_of_voice_signals: string[] | null
  things_to_avoid: string | null
  things_to_avoid_confidence: number | null
  things_to_avoid_signals: string[] | null
  target_audience: string | null
  target_audience_confidence: number | null
  target_audience_signals: string[] | null
  core_offerings: string | null
  core_offerings_jsonb: any | null
  core_offerings_confidence: number | null
  core_offerings_signals: string[] | null
  content_focus: string | null
  content_focus_confidence: number | null
  content_focus_signals: string[] | null
  content_pillars: string | null
  content_pillars_jsonb: any | null
  content_pillars_confidence: number | null
  content_pillars_signals: string[] | null
  cta_style: string | null
  cta_style_confidence: number | null
  cta_style_signals: string[] | null
  communication_goal: string | null
  communication_goal_confidence: number | null
  communication_goal_signals: string[] | null
  image_preferences: string | null
  image_preferences_confidence: number | null
  image_preferences_signals: string[] | null
  updated_at: string
}

// ============================================================================
// EXECUTION PROFILE TYPES
// ============================================================================

import type { LocationEnrichment } from '../../types/location-enrichment.ts'

/**
 * Execution Profile - AI-optimized, structured brand profile
 * 
 * This is the machine-readable layer used by AI post-idea generation.
 * Separates concerns:
 * - Display Profile (BrandProfile above) = user-facing, editable prose
 * - Execution Profile (this type) = compact, validated, AI-consumable structure
 * 
 * Benefits:
 * - Token efficiency: ~30-40% reduction in AI prompts
 * - Location-aware personalization: macro + micro context
 * - Platform-specific logic: Instagram vs Facebook CTA handling
 * - Single source of truth: validated once, used everywhere
 * 
 * @version 1.0
 */
export type ExecutionProfile = {
  /** Schema version for future compatibility */
  version: "1.0"
  
  /** Locale and regional context */
  locale_context: {
    primary_language: string  // e.g., "Danish", "English"
    country?: string  // e.g., "Denmark", "Sweden"
    city?: string  // e.g., "København", "Aarhus"
    city_tier?: string  // "capital" | "major_city" | "mid_city" | "small_town" | "rural"
    region?: string  // Optional: "Sjælland", "Jylland"
  }
  
  /** Micro location characteristics (from LocationEnrichment) */
  micro_location_context: {
    area_type: LocationEnrichment["micro"]["area_type"]
    nearby_signals: string[]  // Short labels: ["ved åen", "nær banegård"]
    confidence: LocationEnrichment["micro"]["confidence"]
  }
  
  /** 
   * Usage occasions - extracted from target_audience.value
   * 2-6 situation-rich phrases describing WHEN guests use the venue
   * Example: ["Når gæster samles om længere brunch", "når børn kan spise med", "når aftenen glider fra middag til cocktails"]
   */
  usage_occasions: string[]
  
  /** 
   * Offerings allowlist - what the AI can mention
   * Prevents hallucination while allowing natural language
   */
  offerings_allowlist: {
    menu_items: Array<{ name: string; category?: string }>  // Specific items from menu
    allowed_generics: string[]  // Generic terms: ["brunch", "frokost", "middag", "varm drik"]
  }
  
  /** 
   * Platform-specific CTA policy
   * Encodes platform constraints once, enforced everywhere
   */
  cta_policy: {
    primary_intent: "book" | "visit" | "menu" | "engage"  // Main business goal
    facebook: { 
      allow_url: boolean  // Facebook allows clickable links
    }
    instagram: { 
      allow_url: boolean  // Instagram stories/posts don't allow links
      fallback_text: string  // e.g., "Book via link i bio"
    }
  }
  
  /** 
   * Forbidden terms - strict ban list
   * From things_to_avoid.language_constraints
   * Example: ["lækker", "hyggelig", "afslappet", "autentisk"]
   */
  forbidden_terms: string[]
  
  /** 
   * Photo guidelines - compact rules
   * From image_preferences, but structured for AI consumption
   */
  photo_rules: {
    dos: string[]  // 3 visual best practices
    donts: string[]  // 3 visual anti-patterns
    signature_pattern?: string  // Optional: compact iconic shot description (not a paragraph)
  }
}
