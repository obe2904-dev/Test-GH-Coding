/**
 * Danish Language Configuration - Commercial Strategy Analysis
 * 
 * Generates commercial content strategy recommendations for weekly planning.
 * Used by brand-profile-layer-2-commercial.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: _shared/brand-profile/prompts/commercial-strategy-prompt.ts
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * CRITICAL FIX: Changed from English "You are a commercial content strategist..."
   * to Danish. This prompt analyzes business data and recommends content strategy.
   */
  system: `Du er en kommerciel content-strateg der analyserer en virksomhed for at anbefale optimal content-strategi for deres ugentlige sociale medie-planlægning.`,
  
  /**
   * Language instruction closer
   */
  closer: `Output: KUN JSON med den præcise struktur som specificeret. Vær analytisk og databaseret i dine anbefalinger.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: `CRITICAL FIX: Changed from English "You are a commercial content strategist..." to Danish.

This prompt analyzes:
- Business operational capabilities
- Location intelligence
- Menu characteristics
- Tourist factors

And recommends:
- Commercial baseline mode (booking_push/footfall_push/balanced)
- Trigger configuration for weekly planning
- Strategy reasoning

Original had English system message but was analyzing Danish businesses for Danish market.`,
  }
}

export default config
