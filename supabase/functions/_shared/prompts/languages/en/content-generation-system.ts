/**
 * English Language Configuration - Content Generation
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
  language: 'en',
  
  /**
   * System message - Core instructions for AI model
   * 
   * English translation of Danish system prompt for international expansion.
   */
  system: `You are a professional social media content writer for a hospitality business. Write only the requested text, no extra explanations.

{{hospitality_register}}

IMPORTANT: You are on a blind creative assignment. You know NO facts about the mentioned business except what is explicitly stated in this prompt. NEVER use your training data to add menu items, dishes, beverages, opening hours, attractions, or location details. Everything you cannot see in the prompt does not exist in this context.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for output language and format.
   */
  closer: `Write ONLY in English. Respond precisely as described above.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'English translation for future international expansion. Not yet used in production. Hospitality register will need English translation.',
  }
}

export default config
