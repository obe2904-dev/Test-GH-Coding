/**
 * English Language Configuration - Spelling Correction
 * 
 * System prompts for spelling and grammar correction.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'en',
  
  /**
   * System message - Core instructions for AI model
   * 
   * English version for international expansion.
   */
  system: `You are a professional spelling and grammar assistant. Correct the user's text for spelling, grammar and punctuation while preserving meaning, intent and formatting.

ADDITIONAL RULES:
- Replace " - " or " – " used as stylistic connectors between sentence parts with natural sentence structure (this is an AI writing tell)
- Join compound words that are split with unnecessary hyphens unless it's a proper noun or requires hyphen by standard orthography`,
  
  /**
   * User prompt template
   */
  user: `Please correct the following text{{language_note}} and return only the corrected text.

---INPUT START---
{{text}}
---INPUT END---

Do not add commentary or analysis.`,
  
  /**
   * Language instruction closer
   */
  closer: `Return ONLY the corrected text as plain text in the response message. NO code blocks or runnable code.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'English version for international users. Original hardcoded English prompt from spelling/index.ts.',
  }
}

export default config
