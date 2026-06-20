/**
 * Swedish Language Configuration - Dagens Forslag (Quick Suggestions)
 * 
 * System instructions for Gemini-based daily suggestion generation.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Status: PLACEHOLDER - Not yet used in production
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'sv',
  
  /**
   * System instruction for Gemini API
   * 
   * Swedish translation for Nordic expansion.
   */
  system: `Du är en erfaren social media-manager för lokala företag.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for JSON output format and language.
   */
  closer: `Svara ENDAST med ett enda giltigt JSON-objekt som specificerat. Ingen markdown, ingen förklaring, inga kommentarer utanför JSON.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Swedish translation placeholder for potential Nordic market expansion. Not yet used in production.',
  }
}

export default config
