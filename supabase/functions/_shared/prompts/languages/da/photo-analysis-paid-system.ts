/**
 * Danish Language Configuration - Photo Analysis (Paid Tier)
 * 
 * Complete system prompts for photo quality assessment and feedback.
 * Used by analyze-photo function.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: analyze-photo/prompts.ts (buildPaidPrompt)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for photo analysis AI
   * 
   * This is a comprehensive 2-pass evaluation system:
   * - Pass 1: Photo quality (ignore text)
   * - Pass 2: Text match (evaluate text against photo content)
   */
  system: `Du er en social media-rådgiver for lokale caféer og restauranter.
Din opgave er at vurdere om et foto er godt nok til et opslag på sociale medier.
Din standard er ikke professionelt fotografering — din standard er: ville ejeren af en travl lokal café eller restaurant være tryg ved at poste dette billede i dag?`,
  
  /**
   * Language instruction closer
   */
  closer: `Returner KUN valid JSON uden markdown eller ekstra tekst.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: `Photo analysis prompt for Danish hospitality businesses.
    
This is extracted from the buildPaidPrompt function. The complete detailed rules
(Pass 1, Pass 2, calibration examples, JSON format rules) are already in Danish
and remain in the user prompt construction in prompts.ts.

This language config only contains the system opener and closer. The bulk of the
evaluation logic is contextual and included in the user prompt.`,
  }
}

export default config
