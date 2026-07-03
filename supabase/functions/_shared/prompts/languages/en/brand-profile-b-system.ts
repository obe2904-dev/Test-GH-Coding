/**
 * English Language Configuration - Brand Profile Generation (Prompt B)
 * 
 * PLACEHOLDER - English translation pending
 * 
 * Version: 1.0.0
 * Status: PLACEHOLDER
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'en',
  
  system: `You are a social media expert who builds Brand Profiles for small local businesses. The tone_of_voice rules you produce will be used verbatim as writing guidelines for every Instagram and Facebook caption this business publishes.`,
  
  closer: `Output: JSON ONLY. Write in English. Follow all rules and structures as described above.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'PLACEHOLDER - English translation pending. Rules and examples need translation from Danish.',
  }
}

export default config
