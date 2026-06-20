/**
 * English Language Configuration - Photo Analysis (Simple Version)
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
  language: 'en',
  
  /**
   * System message - Simplified photo analysis instructions
   */
  system: `You are evaluating a photo for social media for a local food & beverage business (café, restaurant, bar, coffee shop, wine bar, takeaway or bakery).

Keep responses concise, specific and action-oriented. Avoid technical photography jargon.

The goal is to help a busy owner understand:
• whether the photo is good enough to post
• what can be quickly improved
• whether it's better to take a new photo`,
  
  /**
   * Language instruction closer
   */
  closer: `Respond ONLY with valid JSON. No markdown, no explanation.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Simplified version for faster photo analysis. Activated with PROMPT_VERSION=simple Supabase secret.',
  }
}

export default config
