/**
 * Language Validator - Detects language leakage (English in non-English content)
 * 
 * Purpose: Structural prevention of English words appearing in non-English content
 * Prevents GPT-4o from defaulting to English phrases like "by the water" instead of "ved åen"
 * 
 * Uses centralized language configurations for extensibility
 */

import { getLanguageConfig, isLanguageSupported } from '../config/language-configs.ts'

export interface LanguageLeakageResult {
  hasLeakage: boolean
  englishTokens: string[]
  severity: 'none' | 'minor' | 'major'
  recommendation?: string
}

/**
 * Detect English word leakage in content for specified language
 * 
 * @param text - Content to check (hook + caption_base combined)
 * @param language - Expected language code (da, sv, de, etc.)
 * @returns Detection result with severity and recommendations
 */
export function detectEnglishLeakage(
  text: string,
  language: string
): LanguageLeakageResult {
  // Only check for non-English languages
  if (language === 'en') {
    return { hasLeakage: false, englishTokens: [], severity: 'none' }
  }

  // Get language configuration (falls back to Danish if not supported)
  const config = getLanguageConfig(language)
  
  if (!isLanguageSupported(language)) {
    console.warn(`⚠️ Language '${language}' not supported for validation, using Danish rules`)
  }

  // Use forbidden tokens from configuration
  const forbiddenEnglishTokens = config.forbiddenTokens

  const lowerText = text.toLowerCase()
  
  // Find all forbidden English tokens present in text
  // Use word boundary matching to avoid false positives (e.g., "anden" contains "and")
  const englishFound = forbiddenEnglishTokens.filter(token => {
    const regex = new RegExp(`\\b${token}\\b`, 'i')
    return regex.test(lowerText)
  })

  if (englishFound.length === 0) {
    return { hasLeakage: false, englishTokens: [], severity: 'none' }
  }

  // Classify severity based on number of English words
  let severity: 'none' | 'minor' | 'major' = 'minor'
  let recommendation: string

  if (englishFound.length >= 5) {
    severity = 'major'
    recommendation = 'CRITICAL: Major English leakage detected. Regenerate this slot.'
  } else if (englishFound.length >= 3) {
    severity = 'major'
    recommendation = 'WARNING: Multiple English words detected. Consider regeneration.'
  } else {
    severity = 'minor'
    recommendation = 'Minor English leakage detected. Monitor for patterns.'
  }

  return {
    hasLeakage: true,
    englishTokens: englishFound,
    severity,
    recommendation
  }
}

/**
 * Detect English phrases (multi-word patterns) in content
 * More sophisticated than single-word detection
 * Uses centralized language configurations
 */
export function detectEnglishPhrases(
  text: string,
  language: string
): { found: string[], suggestions: Record<string, string> } {
  if (language === 'en') {
    return { found: [], suggestions: {} }
  }

  // Get language configuration
  const config = getLanguageConfig(language)
  const lowerText = text.toLowerCase()
  
  // Check for forbidden phrases from configuration
  const foundPhrases: string[] = []
  const suggestions: Record<string, string> = {}
  
  for (const phraseConfig of config.forbiddenPhrases) {
    if (lowerText.includes(phraseConfig.en.toLowerCase())) {
      foundPhrases.push(phraseConfig.en)
      suggestions[phraseConfig.en] = phraseConfig.local
    }
  }

  return { found: foundPhrases, suggestions }
}
