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
  city: string  // Required (from business_locations.city via JOIN or location intelligence)
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

  // Tier 1b - Operational data (from business_operations)
  operations?: any | null  // establishment_type, has_outdoor_seating, has_takeaway

  // Tier 1c - Rich location intelligence (from business_location_intelligence)
  // Contains category_scores, neighborhood, location_marketing_hooks, area_type
  // More granular than business_locations.enrichment (which is lightweight)
  locationIntelligenceRow?: any | null

  // Menu AI summaries (from menu_results_v2.ai_summary)
  // Per-URL helicopter summaries generated at extraction time — used instead of raw item names
  menuSummaries?: { title: string; summary: string }[] | null
  aiSummaryItems?: string[] | null   // Bullet lines stripped of •/-/– prefix, used for proof tokens
  menuSource?: 'ai_summary' | 'structured_data' | 'fallback' | 'none'  // Traceable in logs

  // Tier 3 - Third-party (conditional, read-only)
  thirdPartyEvidence?: ThirdPartyEvidence

  // WP1: Operational programmes from menu_signal (free-tier extraction)
  menuSignalProgrammes?: Array<{ role: string; timeContext: string | null; items: string[] }> | null
  // WP1: Opening hours rows for late-night detection
  openingHoursRows?: Array<{ weekday: string; open_time: string; close_time: string }>
  // WP2: Existing AI-generated business character (prevents blank overwrite, seeds Prompt A)
  existingBusinessCharacter?: string | null
  // v4.12.1: Existing voice rationale (fallback seed for voice_rationale field)
  existingVoiceRationale?: string | null
  // Physical location count (number of business branches)
  locationsCount?: number
}

// ============================================================================
// FEATURE SCORING (v4.12.1 - Voice Over-Indexing Fix)
// ============================================================================

/**
 * Feature with distinctiveness scoring for business_character generation.
 * Used to prioritize features systematically without hardcoding examples.
 */
export interface FeatureScore {
  category: 'operational' | 'temporal' | 'physical'
  text: string
  distinctiveness: number  // 1-10 scale
  seasonal: boolean
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

export interface BrandVariable<TValue = string> {
  value: TValue
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

// ============================================================================
// LOCATION INTELLIGENCE TYPES (deterministic, from populate-location-intelligence)
// ============================================================================

/**
 * Structured location intelligence derived deterministically from
 * business_locations.category_scores + location_marketing_hooks.
 * No AI generation — zero latency, zero tokens.
 * Queryable by post generator for season × motivation × tourist_context combos.
 */
export interface LocationIntelligence {
  primary_type: string              // Highest-scoring area type (e.g. "waterfront")
  matched_motivations: string[]     // Danish copy-hook tokens (e.g. ["destinationsbesøg"])
  marketing_focus: string | null    // Top marketing hook text, or null
  secondary_types: string[]         // Supporting area types (2nd, 3rd scores)
  tourist_context: boolean          // True → generate bilingual variant awareness
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
  location_intelligence?: LocationIntelligence | null   // Deterministic — not AI-generated

  // V2 Brand Profile fields (Marts 2026)
  brand_essence_elaboration?: BrandVariable<string>   // 2–3 strategic sentences below identity anchor
  identity_keywords?: BrandVariable<string[]>         // 3 identity chips — WHO the business IS (≠ tone chips)
  voice_constraints?: BrandVariable<string>           // One principle sentence WHY this style matters (replaces never_say lists)

  /**
   * Plain-text rationale explaining how the Voice rules were derived.
   * Generated by Prompt B, stored as TEXT in business_brand_profile.
   * Explains what signals were available, whether rules are observed vs. assessed,
   * and why this Voice fits this specific business over a generic one.
   */
  voice_rationale?: string

  /**
   * Plain-text, 1–2 sentence factual description of what this business is.
   * Generated by Prompt B, stored as TEXT in business_brand_profile.
   * Consumed by WeekContext.business_character to drive Phase 1 & 2 strategy prompts
   * instead of the deprecated business_type code system.
   * Example: "Café og naturvinbar — brunch og kaffe fra åbning, naturvin og cocktails fra aftenen."
   */
  business_character?: string

  /**
   * AI-generated content strategy for this business.
   * Drives Phase 1 slot assignment: which goal_mode and content_category per weekly post.
   * Stored as JSONB in business_brand_profile.content_strategy.
   */
  content_strategy?: ContentStrategy
}

/**
 * Content strategy for a business — generated by brand-profile-generator Prompt B.
 * Drives the 4-slot weekly content system.
 */
export interface ContentStrategy {
  /** The single dominant business goal for social content */
  primary_goal: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
  /** Percentage split across three goal modes (must sum to 100) */
  goal_blend: {
    drive_footfall: number
    build_brand: number
    retain_loyalty: number
  }
  /** Concrete business signals that justify footfall-focused content */
  footfall_signals: string[]
  /** Core brand identity anchors to protect in brand-building content */
  brand_anchors: string[]
  /** Retention hooks — recurring reasons regulars return */
  loyalty_hooks: string[]
  /** Percentage weight per content category (must sum to 100) */
  content_category_weights: {
    product_menu: number
    craving_visual: number
    behind_scenes: number
    team_people: number
  }
  /**
   * Posting occasions selected for this business by the brand profiler.
   * Stored in business_brand_profile.posting_occasions (JSONB).
   * Phase 0 resolves these weekly into ActiveOccasion[].
   */
  posting_occasions?: PostingOccasion[]
  /**
   * ISO locale used when this profile was generated (e.g. "da-DK").
   * Determines which MARKET_TIMING profile Phase 0 applies.
   */
  profiling_market?: string
}

/**
 * Per-business occasion assignment produced by the brand profiler AI.
 * References an occasion ID from OCCASION_DEFINITIONS in occasion-library.ts.
 */
export interface PostingOccasion {
  occasion_id: string
  /** 1 (lowest priority) – 5 (must always be in plan) */
  priority_weight: number
  /** How many posts per week this occasion typically generates for this business */
  default_slot_count: 1 | 2
  /** Free-text customisations the AI added for this specific business */
  business_customizations: string[]
  /** Week-signal conditions that should boost or dampen this occasion */
  conditional_modifiers: string[]
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

import type { LocationEnrichment } from '../types/location-enrichment.ts'

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
