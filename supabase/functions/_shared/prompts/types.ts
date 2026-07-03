/**
 * Language Configuration Types
 * 
 * Core types for the multilingual prompt system.
 * Supports Danish (da), English (en), and Swedish (sv).
 */

/**
 * Supported languages
 */
export type Language = 'da' | 'en' | 'sv'

/**
 * Language configuration for a specific prompt
 */
export interface LanguageConfig {
  /** Language code */
  language: Language
  
  /** System prompt (instructions for AI model) */
  system: string
  
  /** User prompt template (contains placeholders) */
  user?: string
  
  /** Explicit language instruction closer */
  closer: string
  
  /** Metadata about this prompt */
  metadata?: {
    /** Prompt version (for tracking changes) */
    version: string
    
    /** Last updated timestamp */
    updated: string
    
    /** Author/team responsible */
    author?: string
    
    /** Notes about this version */
    notes?: string
  }
}

/**
 * Prompt variables for template substitution
 */
export interface PromptVariables {
  [key: string]: string | number | boolean | string[]
}

/**
 * Complete prompt structure ready for AI model
 */
export interface CompiledPrompt {
  /** System message */
  system: string
  
  /** User message */
  user: string
  
  /** Language used */
  language: Language
  
  /** Prompt identifier */
  promptId: string
}

/**
 * Prompt template with placeholders
 * Example: "Skriv om {{topic}} i stil med {{brand}}"
 */
export interface PromptTemplate {
  /** Template string with {{variable}} placeholders */
  template: string
  
  /** Required variables that must be provided */
  requiredVariables: string[]
  
  /** Optional variables with default values */
  optionalVariables?: Record<string, string | number | boolean>
}

/**
 * Multilingual prompt set
 * Contains all language variants of a single prompt
 */
export interface MultilingualPrompt {
  /** Prompt identifier */
  id: string
  
  /** Danish version */
  da: LanguageConfig
  
  /** English version */
  en: LanguageConfig
  
  /** Swedish version */
  sv: LanguageConfig
  
  /** Default language if not specified */
  defaultLanguage: Language
}

/**
 * Prompt loading result
 */
export interface PromptLoadResult {
  success: boolean
  prompt?: LanguageConfig
  error?: string
}

/**
 * Content type categories
 */
export type ContentType = 
  | 'menu'           // Food/drink menu items
  | 'atmosphere'     // Location/vibe descriptions
  | 'behind_scenes'  // Kitchen/staff/process
  | 'event'          // Special events
  | 'general'        // General content
  | 'enhancement'    // Text improvement
  | 'suggestion'     // Daily suggestions

/**
 * Tone/voice options
 */
export type VoiceTone = 
  | 'professional'   // Formal, polished
  | 'casual'         // Relaxed, friendly
  | 'enthusiastic'   // Energetic, exciting
  | 'minimal'        // Simple, understated
  | 'storytelling'   // Narrative-driven

/**
 * Platform-specific formatting
 */
export type Platform = 
  | 'instagram'      // Instagram posts/stories
  | 'facebook'       // Facebook posts
  | 'generic'        // Platform-agnostic

/**
 * Quality validation result
 */
export interface QualityValidation {
  /** Passes quality checks */
  valid: boolean
  
  /** Quality score (0-100) */
  score: number
  
  /** Issues detected */
  issues: {
    englishLeakage: string[]
    metaCommentary: string[]
    forbiddenPhrases: string[]
    passiveVoice: string[]
  }
  
  /** Recommendations for improvement */
  recommendations: string[]
}
