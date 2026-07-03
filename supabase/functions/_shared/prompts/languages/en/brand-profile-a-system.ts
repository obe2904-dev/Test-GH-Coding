/**
 * English Language Configuration - Brand Profile Analysis (Prompt A)
 * 
 * PLACEHOLDER - English translation pending
 * 
 * Version: 1.0.0
 * Status: PLACEHOLDER
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'en',
  
  system: `You are an internal analysis assistant that extracts high-signal steering data from business data. Your output is used as input for brand profile generation.`,
  
  closer: `Output: JSON ONLY. Be precise and fact-based. No guesswork.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'PLACEHOLDER - Internal analysis prompt for English language support.',
  }
}

export default config
