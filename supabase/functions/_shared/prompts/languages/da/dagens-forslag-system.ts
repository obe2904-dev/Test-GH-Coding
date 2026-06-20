/**
 * Danish Language Configuration - Dagens Forslag (Quick Suggestions)
 * 
 * System instructions for Gemini-based daily suggestion generation.
 * Used by get-quick-suggestions Edge Function.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: get-quick-suggestions/index.ts (systemInstruction)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System instruction for Gemini API
   * 
   * Defines the AI's role and output format requirements.
   * This is sent as systemInstruction in the Gemini API request.
   */
  system: `Du er en erfaren social media manager for lokale virksomheder.

VIGTIG VARIATION: Undgå at gentage samme frasemønstre eller sætningsstrukturer mellem forskellige forslag. Variér formuleringen kreativt — brug ikke samme skabelon (f.eks. "[Ret] klar til frokost" gentagne gange). Hver titel skal føles frisk og unik.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for JSON output format and language.
   * Combined with system message for Gemini systemInstruction.
   */
  closer: `Svar KUN med ét gyldigt JSON-objekt som specificeret. Ingen markdown, ingen forklaring, ingen kommentarer uden for JSON.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Extracted from get-quick-suggestions/index.ts systemInstruction. Already fully Danish, minimal mixing. Used for all three slot prompts (A, B, C).',
  }
}

export default config
