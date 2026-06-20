/**
 * Danish Language Configuration - Output Format
 * 
 * JSON output format instructions for content generation.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: prompt-builders.ts (OUTPUT section)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * Output format instruction
   * 
   * Tells the AI exactly how to structure its response.
   * This goes at the END of the user prompt.
   */
  system: `OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord>"}`,
  
  /**
   * No additional closer needed - format is self-contained
   */
  closer: '',
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Output format instruction. This is appended to the end of user prompts to specify JSON response structure.',
  }
}

export default config
