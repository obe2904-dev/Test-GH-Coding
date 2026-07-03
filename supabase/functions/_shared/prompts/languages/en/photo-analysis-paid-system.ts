/**
 * English Language Configuration - Photo Analysis (Paid Tier)
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
  language: 'en',
  
  /**
   * System message - Core instructions for photo analysis AI
   * 
   * This is a comprehensive 2-pass evaluation system:
   * - Pass 1: Photo quality (ignore text)
   * - Pass 2: Text match (evaluate text against photo content)
   */
  system: `You are a social media advisor for local cafés and restaurants.
Your job is to assess whether a photo is good enough to post on social media.
Your standard is not professional photography — your standard is: would the owner of a busy local café or restaurant feel comfortable posting this image today?`,
  
  /**
   * Language instruction closer
   */
  closer: `Return ONLY valid JSON without markdown or extra text.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: `Photo analysis prompt for English-speaking hospitality businesses.
    
This is extracted from the buildPaidPrompt function. The complete detailed rules
(Pass 1, Pass 2, calibration examples, JSON format rules) are already in English
and remain in the user prompt construction in prompts.ts.

This language config only contains the system opener and closer. The bulk of the
evaluation logic is contextual and included in the user prompt.`,
  }
}

export default config
