/**
 * Danish Language Configuration - Photo Analysis (Simple Version)
 * 
 * Simplified system prompts for quick photo quality assessment.
 * Used by analyze-photo function when PROMPT_VERSION=simple.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: analyze-photo/prompts.ts (buildSimplePrompt)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Simplified photo analysis instructions
   */
  system: `Du vurderer et foto til sociale medier for en lokal virksomhed i food & beverage branchen (café, restaurant, bar, kaffebar, vinbar, takeaway eller bageri).

Svar kort, konkret og handlingsorienteret. Undgå teknisk fotosprog.

Målet er at hjælpe en travl ejer med at forstå:
• om fotoet er godt nok til opslag
• hvad der hurtigt kan forbedres
• om det er bedre at tage et nyt foto`,
  
  /**
   * Language instruction closer
   */
  closer: `Svar KUN med valid JSON. Ingen markdown, ingen forklaring.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Simplified version for faster photo analysis. Activated with PROMPT_VERSION=simple Supabase secret.',
  }
}

export default config
