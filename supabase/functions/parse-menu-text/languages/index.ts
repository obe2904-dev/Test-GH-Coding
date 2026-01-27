/**
 * Language Configuration Registry
 * Centralized management of all supported languages
 */

import { danish } from './danish.ts'
import { swedish } from './swedish.ts'
import { dutch } from './dutch.ts'
import { LanguageConfig, LanguageCode } from '../types.ts'

// Registry of all supported languages
export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  da: danish,
  sv: swedish,
  nl: dutch,
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    ocrCorrections: {
      // English generally has fewer OCR issues
      // Mainly proper nouns and brand names
      'teh': 'the',
      'restuarant': 'restaurant',
    },
    systemPrompt: `You are an expert in American culinary terminology and food culture. You understand:
- American ingredient names and measurements
- French culinary terms commonly used in US restaurants
- Authentic American cuisine
- Proper spelling and capitalization`,
    correctionInstructions: `CRITICAL CORRECTIONS TO LOOK FOR:

1. **French Terms**: Maintain proper French spellings and accents:
   - "crôutons" (not "croutons")
   - "crème brûlée" (not "creme brulee")
   - "velouté" (not "veloute")

2. **Brand Names**: Keep proper capitalization for brands

3. **Measurements**: Verify standard US measurements (cups, oz, lbs)

4. **American Food Terms**: Authentic American dish names`,
  },
}

/**
 * Get language configuration by code
 * @param code Language code (e.g., 'da', 'sv', 'nl', 'en-US')
 * @param defaultCode Fallback language code if not found (default: 'en-US')
 * @returns Language configuration
 */
export function getLanguageConfig(
  code: string,
  defaultCode: LanguageCode = 'en-US'
): LanguageConfig {
  return LANGUAGES[code as LanguageCode] || LANGUAGES[defaultCode]
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGES)
}

/**
 * Get language code from language name
 */
export function getLanguageCodeByName(name: string): LanguageCode | null {
  const entry = Object.entries(LANGUAGES).find(([_, config]) =>
    config.name.toLowerCase().includes(name.toLowerCase())
  )
  return entry ? (entry[0] as LanguageCode) : null
}
