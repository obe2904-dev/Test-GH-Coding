/**
 * Language Configuration Types
 * Defines the structure for language-specific menu parsing and correction
 */

export interface LanguageConfig {
  /** Language code (e.g., 'da', 'sv', 'nl', 'en-US') */
  code: string
  
  /** Display name */
  name: string
  
  /** OCR correction dictionary: [misspelled] -> [correct] */
  ocrCorrections: Record<string, string>
  
  /** System prompt for GPT-4o with language-specific culinary context */
  systemPrompt: string
  
  /** Critical correction instructions for the model */
  correctionInstructions: string
  
  /** Language-specific verification rules */
  verificationRules?: string
}

export type LanguageCode = 'da' | 'sv' | 'nl' | 'en-US'
