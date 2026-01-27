/**
 * Centralized AI Configuration
 * 
 * All AI model settings, token limits, and language mappings in one place.
 * Makes it easy to:
 * - Adjust costs by switching models
 * - Fine-tune temperatures for different tasks
 * - Add new languages across all extractors
 * 
 * USAGE:
 * import { AI_MODELS, AI_TASKS, LANGUAGES, getLanguageCode } from '../_shared/ai-config.ts'
 */

// ============================================================================
// MODELS
// ============================================================================

export const AI_MODELS = {
  // Premium - best quality, higher cost (~$5/1M input, $15/1M output)
  premium: 'gpt-4o',
  
  // Fast - good quality, lower cost (~$0.15/1M input, $0.60/1M output)  
  fast: 'gpt-4o-mini',
  
  // Vision - for image analysis
  vision: 'gemini-2.0-flash-exp'
} as const

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS]

// ============================================================================
// TASK CONFIGURATIONS
// Each task has its recommended model, temperature, and token limit
// ============================================================================

export interface TaskConfig {
  model: AIModel
  temperature: number
  maxTokens: number
  description: string
}

export const AI_TASKS: Record<string, TaskConfig> = {
  // Website Analysis Extractors
  basicInfo: {
    model: AI_MODELS.premium,
    temperature: 0.1,
    maxTokens: 300,
    description: 'Extract business name, type, description'
  },
  contact: {
    model: AI_MODELS.premium,
    temperature: 0.1,
    maxTokens: 500,
    description: 'Extract phone, email, address'
  },
  keywords: {
    model: AI_MODELS.premium,
    temperature: 0.3,
    maxTokens: 200,
    description: 'Generate descriptive keywords'
  },
  menu: {
    model: AI_MODELS.premium,
    temperature: 0.0,
    maxTokens: 3000,
    description: 'Extract menu structure and items'
  },
  menuFastPath: {
    model: AI_MODELS.fast,
    temperature: 0.0,
    maxTokens: 2500,
    description: 'Quick menu extraction from HTML'
  },
  linkClassification: {
    model: AI_MODELS.fast,
    temperature: 0.1,
    maxTokens: 500,
    description: 'Classify website links'
  },
  venueHooks: {
    model: AI_MODELS.premium,
    temperature: 0.2,
    maxTokens: 1200,
    description: 'Extract concrete venue-specific hooks with evidence'
  },
  experiencePillars: {
    model: AI_MODELS.premium,
    temperature: 0.2,
    maxTokens: 800,
    description: 'Recommend reliable content pillars + supported assets (evidence-based)'
  },
  
  // Content Generation
  photoIdea: {
    model: AI_MODELS.fast,
    temperature: 0.3,
    maxTokens: 100,
    description: 'Suggest photo ideas for posts'
  },
  spelling: {
    model: AI_MODELS.fast,
    temperature: 0.3,
    maxTokens: 1200,
    description: 'Spelling and grammar correction'
  },
  postGeneration: {
    model: AI_MODELS.fast, // Upgraded by tier
    temperature: 0.8,
    maxTokens: 1500,
    description: 'Generate social media posts'
  },
  
  // Brand Profile
  brandAnalysis: {
    model: AI_MODELS.premium,
    temperature: 0.3,
    maxTokens: 2000,
    description: 'Analyze brand signals (Prompt A)'
  },
  brandGeneration: {
    model: AI_MODELS.premium,
    temperature: 0.5,
    maxTokens: 3000,
    description: 'Generate brand profile (Prompt B)'
  },
  brandRepair: {
    model: AI_MODELS.premium,
    temperature: 0.3,
    maxTokens: 3000,
    description: 'Repair invalid brand profile output'
  },
  brandContext: {
    model: AI_MODELS.premium,
    temperature: 0.7,
    maxTokens: 2000,
    description: 'Generate brand context document'
  },
  
  // Photo Analysis
  photoAnalysis: {
    model: AI_MODELS.vision,
    temperature: 0.7,
    maxTokens: 2048,
    description: 'Analyze photos for social media'
  }
} as const

// ============================================================================
// CONTENT LENGTH LIMITS
// Prevents sending too much data to AI (saves tokens/cost)
// ============================================================================

export const CONTENT_LIMITS = {
  basicInfo: 3000,      // chars for basic info extraction
  contact: 8000,        // chars for contact extraction (needs more to find footer)
  keywords: 2000,       // chars for keyword generation
  menu: 50000,          // chars for menu extraction
  menuFastPath: 22000,  // chars for edge function menu parsing
  venueHooks: 35000,    // chars for venue hook extraction
  experiencePillars: 18000, // chars for experience pillars extraction
} as const

// ============================================================================
// LANGUAGE CONFIGURATION
// Centralized language support - add new languages here
// ============================================================================

export type LanguageCode = 'da' | 'no' | 'sv' | 'de' | 'en'

export interface LanguageInfo {
  code: LanguageCode
  name: string
  nativeName: string
  countryCode: string
  phoneCode: string
  postalCodeDigits: number
  defaultCountry: string
}

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  da: {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    countryCode: 'DK',
    phoneCode: '+45',
    postalCodeDigits: 4,
    defaultCountry: 'Danmark'
  },
  no: {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    countryCode: 'NO',
    phoneCode: '+47',
    postalCodeDigits: 4,
    defaultCountry: 'Norge'
  },
  sv: {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    countryCode: 'SE',
    phoneCode: '+46',
    postalCodeDigits: 5,
    defaultCountry: 'Sverige'
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    countryCode: 'DE',
    phoneCode: '+49',
    postalCodeDigits: 5,
    defaultCountry: 'Deutschland'
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    countryCode: 'GB',
    phoneCode: '+44',
    postalCodeDigits: 0, // varies
    defaultCountry: 'United Kingdom'
  }
}

// Map various language/country codes to our supported languages
export const LANGUAGE_MAP: Record<string, LanguageCode> = {
  // Danish
  'da': 'da', 'dk': 'da', 'dan': 'da',
  // Norwegian
  'no': 'no', 'nb': 'no', 'nn': 'no', 'nor': 'no',
  // Swedish
  'sv': 'sv', 'se': 'sv', 'swe': 'sv',
  // German (includes Austria, Switzerland)
  'de': 'de', 'deu': 'de', 'ger': 'de', 'at': 'de', 'ch': 'de',
  // English
  'en': 'en', 'eng': 'en', 'gb': 'en', 'uk': 'en', 'us': 'en'
}

/**
 * Get normalized language code from various input formats
 * @param langHint - Language code from HTML lang attribute, country code, etc.
 * @param defaultLang - Default language if not found (defaults to 'da')
 */
export function getLanguageCode(langHint: string | null | undefined, defaultLang: LanguageCode = 'da'): LanguageCode {
  if (!langHint) return defaultLang
  const normalized = langHint.toLowerCase().split('-')[0] // Handle 'da-DK' format
  return LANGUAGE_MAP[normalized] || defaultLang
}

/**
 * Get full language info from a language hint
 */
export function getLanguageInfo(langHint: string | null | undefined, defaultLang: LanguageCode = 'da'): LanguageInfo {
  const code = getLanguageCode(langHint, defaultLang)
  return LANGUAGES[code]
}

// ============================================================================
// TIER-BASED MODEL SELECTION
// For features that upgrade model based on user's subscription
// ============================================================================

export type UserTier = 'free' | 'standardplus' | 'premium'

export interface TierConfig {
  model: AIModel
  temperature: number
  maxTokens: number
}

export const TIER_MODELS: Record<UserTier, TierConfig> = {
  free: {
    model: AI_MODELS.fast,
    temperature: 0.3,
    maxTokens: 500
  },
  standardplus: {
    model: AI_MODELS.premium,
    temperature: 0.7,
    maxTokens: 1000
  },
  premium: {
    model: AI_MODELS.premium,
    temperature: 0.7,
    maxTokens: 1500
  }
}

export function getModelForTier(tier: UserTier | string): TierConfig {
  const normalizedTier = (tier?.toLowerCase() || 'free') as UserTier
  return TIER_MODELS[normalizedTier] || TIER_MODELS.free
}
