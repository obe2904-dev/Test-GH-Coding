/**
 * Brand Profile Module
 * 
 * Centralized exports for all brand profile functionality.
 * Import from this file for clean, organized access.
 */

// Types
export type {
  LanguageConfig,
  DataSources,
  BrandProfile,
  BrandVariable,
  ImagePreferencesValue,
  ThingsToAvoidValue,
  InternalAnalysis,
  ValidationResult,
  BrandProfileRecord
} from './types.ts'

// Languages
export {
  LANGUAGES,
  COUNTRY_FALLBACKS,
  getLanguageByCode,
  getLanguageByCountry,
  detectLanguageFromData
} from './languages.ts'

// OpenAI Client
export {
  fetchOpenAIWithRetry,
  callOpenAI,
  parseOpenAIJson,
  OPENAI_CONFIG,
  OpenAIHttpError
} from './openai-client.ts'

// Data Gathering
export {
  gatherDataSources,
  buildMenuSummary,
  buildMenuTypeSummary,
  buildImagesSummary,
  buildSocialSummary
} from './data-gatherer.ts'

// Signal Extraction
export {
  extractStructuredWebsiteData,
  ensureMustUsePhrasesFallback
} from './signal-extractor.ts'
export type { StructuredWebsiteData } from './signal-extractor.ts'

// Prompts
export {
  buildPromptA,
  buildPromptB,
  buildSystemPromptB,
  computeAllowedSet
} from './prompts/index.ts'

// Validators
export {
  validateBrandProfileOutput,
  validateFinalBrandProfile,
  repairBrandProfile,
  categorizeErrors
} from './validators.ts'
export { META_TEXT_PATTERNS, checkBannedWordsConsistency } from './meta-text-validator.ts'
export { buildAllowedProofTokens, buildNormalizedRefs } from './proof-tokens.ts'

// Database
export {
  saveBrandProfile,
  fetchBrandProfile,
  deleteBrandProfile
} from './database.ts'

// Error Management
export {
  ErrorCollector,
  ErrorCategory,
  ErrorSeverity
} from './errors.ts'
export type { BrandProfileError } from './errors.ts'

// Locale System
export {
  LOCALES,
  resolveLocale,
  getTranslation
} from './locales.ts'
export type { LocaleConfig } from './locales.ts'

// Fallback System
export {
  buildBrandEssenceFallback,
  buildSignatureShotFallback,
  buildTargetAudienceFallback,
  buildToneOfVoiceFallback,
  buildContentFocusFallback,
  removeBannedWords,
  sanitizeBannedWords,
  FallbackTier
} from './fallbacks.ts'
export type { FallbackContext, FallbackResult } from './fallbacks.ts'

// Tone Model Sanitizer (v4.7.3)
export {
  sanitizeToneModelForDb,
  runToneModelSanitizerTests
} from './tone-model.ts'
export type { ToneModelV2 } from './tone-model.ts'

// Website Presence Detection (v4.9.0)
export {
  detectWebsitePresence,
  logWebsitePresence
} from './website-presence.ts'
export type { WebsitePresence } from './website-presence.ts'

// Location Intelligence (deterministic — from category_scores + marketing_hooks)
export {
  buildLocationIntelligence,
  buildGeoContextBlock
} from './location-intelligence.ts'
export type { LocationIntelligence } from './types.ts'

// Voice Options Generator (v2 — two-source model)
export {
  generateVoiceOptions
} from './voice-options-generator.ts'
export type { VoiceOptions, VoiceOption, VoiceSource, SecondarySignals } from './voice-options-generator.ts'
