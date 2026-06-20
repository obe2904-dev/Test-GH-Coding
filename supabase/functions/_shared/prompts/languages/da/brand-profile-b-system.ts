/**
 * Danish Language Configuration - Brand Profile Generation (Prompt B)
 * 
 * System prompts for generating brand profiles from analyzed business data.
 * Used by brand-profile-generator-v5.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: _shared/brand-profile/prompts/prompt-b.ts
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * CRITICAL FIX: Changed from English "You are a social media expert..." to Danish.
   * This was causing major language mixing - English system instruction with Danish
   * rules, Danish forbidden words list, and Danish output expectations.
   * 
   * The detailed rules and examples are already in Danish in the original file
   * and should remain in the full user prompt construction.
   */
  system: `Du er en social media-ekspert der bygger Brand Profiles for små lokale virksomheder. De tone_of_voice-regler du producerer vil blive brugt ordret som skrivevejledning for hver eneste Instagram- og Facebook-caption denne virksomhed udgiver.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit output format instruction.
   */
  closer: `Output: KUN JSON. Skriv på dansk. Følg alle regler og strukturer som beskrevet ovenfor.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: `CRITICAL FIX: Changed from English "You are a social media expert..." to Danish "Du er en social media-ekspert...". 
    
Original had severe mixing:
- English system: "You are a social media expert..."
- Danish forbidden words: "uforglemmelig, magisk, gastronomisk..."
- Danish rules and examples throughout
- Danish output expected

This file contains only the system message opener and closer. The detailed rules (ABSOLUTTE FORBUD, LOCATION CONTEXT, META-COMMENTARY DETECTION, etc.) are in Danish and should be included in the user prompt construction in prompt-b.ts. They are NOT part of this language config because they are data-driven and contextual.`,
  }
}

export default config
