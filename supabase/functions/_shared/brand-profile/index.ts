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
  BRAND_PROFILE_SCHEMA
} from './prompts/index.ts'

// A1/A2 Split Architecture (v4.11.0)
export {
  buildPromptA1Evidence,
  buildPromptA2Interpretation
} from './prompts/index.ts'
export type {
  PromptA1Evidence,
  PromptA2Interpretation
} from './prompts/index.ts'

// Validators
export {
  validateBrandProfileOutput,
  validateFinalBrandProfile,
  repairBrandProfile,
  buildAllowedProofTokens,
  buildNormalizedRefs,
  META_TEXT_PATTERNS
} from './validators.ts'

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

// Soft Repairs (v4.9.0)
export {
  categorizeErrors,
  applySoftRepairs,
  logRepairResults,
  isHardError
} from './soft-repairs.ts'
export type { RepairResult } from './soft-repairs.ts'

// Proof Grounding (v4.9.0 Phase 2)
export {
  cleanProofArray,
  applyProofGrounding,
  logProofGroundingResults,
  validateDishKeywordsInProof
} from './proof-grounding.ts'
