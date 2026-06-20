/**
 * English Language Configuration - Dagens Forslag (Quick Suggestions)
 * 
 * System instructions for Gemini-based daily suggestion generation.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Status: PLACEHOLDER - Not yet used in production
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'en',
  
  /**
   * System instruction for Gemini API
   * 
   * English translation for international expansion.
   */
  system: `You are an experienced social media manager for local businesses.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for JSON output format and language.
   */
  closer: `Respond ONLY with a single valid JSON object as specified. No markdown, no explanation, no comments outside the JSON.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'English translation placeholder for future international expansion. Not yet used in production.',
  }
}

export default config
