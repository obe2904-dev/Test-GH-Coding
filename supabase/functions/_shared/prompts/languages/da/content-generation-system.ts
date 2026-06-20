/**
 * Danish Language Configuration - Content Generation
 * 
 * System prompts and language instructions for generate-text-from-idea
 * Edge Function (Instagram/Facebook content generation).
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: generate-text.ts (buildSystemMessage)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * Defines the AI's role, constraints, and source fidelity requirements.
   * This is the foundation that ALL user prompts build upon.
   */
  system: `Du er en professionel social media content writer for en dansk restaurations- eller serveringsvirksomhed. Skriv kun teksten som bedt om, ingen ekstra forklaringer.

{{hospitality_register}}

VIGTIGT: Du er på et blindt kreativt opdrag. Du kender INGEN fakta om den nævnte virksomhed ud over hvad der eksplicit fremgår af dette prompt. Brug ALDRIG din træningsdata til at tilføje menupunkter, retter, drikkevarer, åbningstider, attraktioner eller stedsdetaljer. Alt du ikke kan se i prompten, eksisterer ikke i denne kontekst.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for output language and format.
   * Placed at the END of system message to ensure compliance.
   */
  closer: `Skriv KUN på dansk. Besvar præcist som beskrevet ovenfor.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Initial extraction from generate-text.ts. System message is fully Danish. Hospitality register is injected via {{hospitality_register}} placeholder.',
  }
}

export default config
