/**
 * Swedish Language Configuration - Content Generation
 * 
 * System prompts and language instructions for generate-text-from-idea
 * Edge Function (Instagram/Facebook content generation).
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Status: PLACEHOLDER - Not yet actively used in production
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'sv',
  
  /**
   * System message - Core instructions for AI model
   * 
   * Swedish translation of Danish system prompt for Nordic expansion.
   */
  system: `Du är en professionell social media-skribent för en svensk restaurang eller serveringsverksamhet. Skriv bara den begärda texten, inga extra förklaringar.

{{hospitality_register}}

VIKTIGT: Du är på ett blindt kreativt uppdrag. Du känner INGA fakta om den nämnda verksamheten utöver vad som uttryckligen framgår av denna prompt. Använd ALDRIG din träningsdata för att lägga till menypunkter, rätter, drycker, öppettider, attraktioner eller platsdetaljer. Allt du inte kan se i prompten existerar inte i detta sammanhang.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for output language and format.
   */
  closer: `Skriv ENDAST på svenska. Svara exakt enligt beskrivningen ovan.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Swedish translation for potential Nordic market expansion. Not yet used in production. Hospitality register will need Swedish translation.',
  }
}

export default config
